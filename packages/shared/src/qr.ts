const VERSION = 4;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const QUIET_ZONE = 4;
const FORMAT_ECL_LOW = 1;

type Matrix = boolean[][];

const createMatrix = (size: number, value = false): Matrix =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => value));

const utf8Bytes = (value: string) => {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.codePointAt(index) ?? 0;
    if (codePoint > 0xffff) index += 1;

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }

  return bytes;
};

const appendBits = (bits: number[], value: number, length: number) => {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >> index) & 1);
  }
};

const encodeData = (value: string) => {
  const payload = utf8Bytes(value || "goldeouro");
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, payload.length, 8);
  payload.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  if (bits.length > capacityBits) {
    throw new Error("QR payload is too long for the local invite QR encoder.");
  }

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let valueByte = 0;
    for (let bit = 0; bit < 8; bit += 1) valueByte = (valueByte << 1) | bits[index + bit];
    codewords.push(valueByte);
  }

  for (let padIndex = 0; codewords.length < DATA_CODEWORDS; padIndex += 1) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  return codewords;
};

const buildGfTables = () => {
  const exp = Array.from({ length: 512 }, () => 0);
  const log = Array.from({ length: 256 }, () => 0);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let index = 255; index < exp.length; index += 1) {
    exp[index] = exp[index - 255];
  }

  return { exp, log };
};

const gf = buildGfTables();

const gfMultiply = (left: number, right: number) =>
  left === 0 || right === 0 ? 0 : gf.exp[gf.log[left] + gf.log[right]];

const polynomialMultiply = (left: number[], right: number[]) => {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      result[leftIndex + rightIndex] ^= gfMultiply(left[leftIndex], right[rightIndex]);
    }
  }

  return result;
};

const reedSolomonGenerator = (degree: number) => {
  let generator = [1];
  for (let index = 0; index < degree; index += 1) {
    generator = polynomialMultiply(generator, [1, gf.exp[index]]);
  }
  return generator;
};

const reedSolomonRemainder = (data: number[], degree: number) => {
  const generator = reedSolomonGenerator(degree);
  const remainder = Array.from({ length: degree }, () => 0);

  data.forEach((byte) => {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[degree - 1] = 0;

    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  });

  return remainder;
};

const maskCondition = (mask: number, row: number, column: number) => {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
  }
};

const getFormatBits = (mask: number) => {
  const data = (FORMAT_ECL_LOW << 3) | mask;
  let remainder = data;

  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >> 9) & 1) === 1 ? 0x537 : 0);
  }

  return ((data << 10) | (remainder & 0x3ff)) ^ 0x5412;
};

const setFunctionModule = (
  modules: Matrix,
  reserved: Matrix,
  row: number,
  column: number,
  dark: boolean,
) => {
  if (row < 0 || column < 0 || row >= SIZE || column >= SIZE) return;
  modules[row][column] = dark;
  reserved[row][column] = true;
};

const drawFinder = (modules: Matrix, reserved: Matrix, row: number, column: number) => {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      setFunctionModule(modules, reserved, row + r, column + c, false);
    }
  }

  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setFunctionModule(modules, reserved, row + r, column + c, edge || center);
    }
  }
};

const drawAlignment = (modules: Matrix, reserved: Matrix, centerRow: number, centerColumn: number) => {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      setFunctionModule(
        modules,
        reserved,
        centerRow + r,
        centerColumn + c,
        Math.max(Math.abs(r), Math.abs(c)) !== 1,
      );
    }
  }
};

const drawFunctionPatterns = () => {
  const modules = createMatrix(SIZE);
  const reserved = createMatrix(SIZE);

  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, 0, SIZE - 7);
  drawFinder(modules, reserved, SIZE - 7, 0);

  for (let index = 0; index < SIZE; index += 1) {
    if (!reserved[6][index]) setFunctionModule(modules, reserved, 6, index, index % 2 === 0);
    if (!reserved[index][6]) setFunctionModule(modules, reserved, index, 6, index % 2 === 0);
  }

  drawAlignment(modules, reserved, 26, 26);
  reserveFormatModules(modules, reserved);

  return { modules, reserved };
};

const reserveFormatModules = (modules: Matrix, reserved: Matrix) => {
  for (let index = 0; index <= 5; index += 1) setFunctionModule(modules, reserved, 8, index, false);
  setFunctionModule(modules, reserved, 8, 7, false);
  setFunctionModule(modules, reserved, 8, 8, false);
  setFunctionModule(modules, reserved, 7, 8, false);
  for (let index = 9; index < 15; index += 1) setFunctionModule(modules, reserved, 14 - index, 8, false);

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(modules, reserved, 8, SIZE - 1 - index, false);
  }
  for (let index = 8; index < 15; index += 1) {
    setFunctionModule(modules, reserved, SIZE - 15 + index, 8, false);
  }
  setFunctionModule(modules, reserved, SIZE - 8, 8, true);
};

const drawFormatBits = (modules: Matrix, mask: number) => {
  const bits = getFormatBits(mask);
  const readBit = (index: number) => ((bits >> index) & 1) === 1;

  for (let index = 0; index <= 5; index += 1) modules[8][index] = readBit(index);
  modules[8][7] = readBit(6);
  modules[8][8] = readBit(7);
  modules[7][8] = readBit(8);
  for (let index = 9; index < 15; index += 1) modules[14 - index][8] = readBit(index);

  for (let index = 0; index < 8; index += 1) modules[8][SIZE - 1 - index] = readBit(index);
  for (let index = 8; index < 15; index += 1) modules[SIZE - 15 + index][8] = readBit(index);
  modules[SIZE - 8][8] = true;
};

const drawCodewords = (base: Matrix, reserved: Matrix, bits: number[], mask: number) => {
  const modules = base.map((row) => [...row]);
  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const row = upward ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (reserved[row][column]) continue;

        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        modules[row][column] = bit !== maskCondition(mask, row, column);
        bitIndex += 1;
      }
    }

    upward = !upward;
  }

  drawFormatBits(modules, mask);
  return modules;
};

const buildDataBits = (value: string) => {
  const data = encodeData(value);
  const ecc = reedSolomonRemainder(data, ECC_CODEWORDS);
  const codewords = [...data, ...ecc];
  const bits: number[] = [];
  codewords.forEach((byte) => appendBits(bits, byte, 8));
  return bits;
};

const penaltyScore = (matrix: Matrix) => {
  let penalty = 0;

  const scoreRun = (line: boolean[]) => {
    let runColor = line[0];
    let runLength = 1;
    let score = 0;

    for (let index = 1; index < line.length; index += 1) {
      if (line[index] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) score += runLength - 2;
        runColor = line[index];
        runLength = 1;
      }
    }

    if (runLength >= 5) score += runLength - 2;
    return score;
  };

  for (let row = 0; row < SIZE; row += 1) penalty += scoreRun(matrix[row]);
  for (let column = 0; column < SIZE; column += 1) {
    penalty += scoreRun(matrix.map((row) => row[column]));
  }

  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) {
      const color = matrix[row][column];
      if (
        matrix[row][column + 1] === color &&
        matrix[row + 1][column] === color &&
        matrix[row + 1][column + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  const darkCount = matrix.flat().filter(Boolean).length;
  const total = SIZE * SIZE;
  penalty += Math.floor(Math.abs((darkCount * 20) - (total * 10)) / total) * 10;

  return penalty;
};

const addQuietZone = (matrix: Matrix) => {
  const size = matrix.length + QUIET_ZONE * 2;
  const quietMatrix = createMatrix(size);

  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      quietMatrix[row + QUIET_ZONE][column + QUIET_ZONE] = matrix[row][column];
    }
  }

  return quietMatrix;
};

export const createQrMatrix = (value: string) => {
  const bits = buildDataBits(value);
  const { modules, reserved } = drawFunctionPatterns();

  let bestMatrix = drawCodewords(modules, reserved, bits, 0);
  let bestPenalty = penaltyScore(bestMatrix);

  for (let mask = 1; mask < 8; mask += 1) {
    const nextMatrix = drawCodewords(modules, reserved, bits, mask);
    const nextPenalty = penaltyScore(nextMatrix);
    if (nextPenalty < bestPenalty) {
      bestMatrix = nextMatrix;
      bestPenalty = nextPenalty;
    }
  }

  return addQuietZone(bestMatrix);
};
