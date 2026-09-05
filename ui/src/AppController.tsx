import "./styles/global.css";
import { AppView } from "./app/AppView";
import { useAppRuntime } from "./app/useAppRuntime";

export function AppController() {
  return <AppView runtime={useAppRuntime()} />;
}
