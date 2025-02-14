import React, { useState, useEffect, useRef } from 'react';
import "./App.css";
import Login from "./Login";
import Chatbot from "./Chatbot";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem("auth") === "true");

  return (
      <div>
          {isAuthenticated ? (
              <Chatbot />
          ) : (
              <Login setIsAuthenticated={setIsAuthenticated} />
          )}
      </div>
  );
}

export default App;

