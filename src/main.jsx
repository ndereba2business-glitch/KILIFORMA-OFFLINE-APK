import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { registerServiceWorker } from "./lib/offline/registerServiceWorker";
import "./styles/theme.css";
import "./styles/tokens.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// Production only. Caches the app shell so the app opens with no data at all;
// data caching is separate (src/lib/offline/net.js).
registerServiceWorker();
