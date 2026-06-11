import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react-native";
import { AppButton, Card, Screen, Subtitle, Title } from "./ui";
import { colors } from "../theme/tokens";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[APP ERROR BOUNDARY]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Screen>
        <Card variant="soft">
          <AlertCircle color={colors.red} size={36} />
          <Title>Algo saiu do eixo</Title>
          <Subtitle>O app encontrou uma falha visual inesperada. Tente recarregar a tela.</Subtitle>
          <AppButton
            onPress={() => this.setState({ hasError: false })}
            title="Tentar novamente"
          />
        </Card>
      </Screen>
    );
  }
}
