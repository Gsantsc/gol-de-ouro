import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react-native";
import { AppButton, Card, Screen, Subtitle, Title } from "./ui";
import { colors } from "../theme/tokens";

type Props = { children: ReactNode };
type State = { errorMessage?: string; hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.setState({ errorMessage });

    if (__DEV__) {
      console.error("[APP ERROR BOUNDARY]", {
        componentStack: info.componentStack,
        error,
        errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    } else {
      console.error("[APP ERROR BOUNDARY]", errorMessage);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Screen>
        <Card variant="soft">
          <AlertCircle color={colors.red} size={36} />
          <Title>Algo saiu do eixo</Title>
          <Subtitle>O app encontrou uma falha visual inesperada. Tente recarregar a tela.</Subtitle>
          {__DEV__ && this.state.errorMessage ? <Subtitle>{this.state.errorMessage}</Subtitle> : null}
          <AppButton
            onPress={() => this.setState({ hasError: false })}
            title="Tentar novamente"
          />
        </Card>
      </Screen>
    );
  }
}
