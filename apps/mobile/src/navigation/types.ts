export type RootStackParamList = {
  Competitions: {
    groupMembers?: any;
    rankings?: any;
  };

  // outras rotas existentes podem ser adicionadas aqui...
};

export type NativeStackScreenProps<ParamList, RouteName extends keyof ParamList> = {
  route: {
    params?: ParamList[RouteName];
  };
};
