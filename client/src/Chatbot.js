import React, { useState, useEffect, useRef } from 'react';
import "./App.css";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const messagesEndRef = useRef(null);

  const handleLogout = () => {
     localStorage.removeItem("auth");
     window.location.reload();
    };

  useEffect(() => {
    const newSessionId = Math.random().toString(36).substring(7);
    setSessionId(newSessionId);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const currentInput = input;
    setInput("");

    const userMessage = { text: currentInput, sender: "user" };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentInput, sessionId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage = { text: data.response, sender: "bot" };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Errore nella richiesta:", error);
    }
  };

  return (
    <>
      <div className='navbar'>
        <div className='logo d-title-font'>LawBot</div>
        <button className="submit-logout" onClick={handleLogout}>Logout</button>
      </div>
      <div className='container'>
        <div className='box-chat d-font'>
          <div className="messages-wrapper">
            {messages.map((msg, index) => (
                <div key={index} className="message-container">
                  {msg.sender === 'bot' && (
                    <div className="bot-avatar">
                      <img src="/bot-icon.png" alt="Bot" />
                    </div>
                  )}
                  <div className={`chat-message ${msg.sender}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className='input-box'>
          <input 
            type='text' 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()} 
            className='input'
          />
          <button className='icon' onClick={sendMessage}></button>
        </div>
      </div>
    </>
  );
}

export default Chat;