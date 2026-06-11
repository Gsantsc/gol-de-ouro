import { registerRootComponent } from "expo";
import AppRoot from "./src/screens/AppRoot";
import "./src/pwa/registerServiceWorker";

registerRootComponent(AppRoot);
