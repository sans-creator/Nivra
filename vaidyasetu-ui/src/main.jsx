import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";             // <-- IMPORTANT
import { AppProvider } from "./context/AppContext.jsx"
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
           <BrowserRouter>
       <AppProvider>
         <App />
       </AppProvider>
     </BrowserRouter>
   </ClerkProvider>
  </React.StrictMode>
);
