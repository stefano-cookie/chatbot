import { useState } from "react";
import "./App.css";

const Login = ({ setIsAuthenticated }) => {
    const [accessKey, setAccessKey] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`http://127.0.0.1:5001/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessKey })
            });

            const data = await response.json();
            if (data.success) {
                localStorage.setItem("auth", "true");
                setIsAuthenticated(true);
            } else {
                setError("Chiave errata");
            }
        } catch (error) {
            setError("Errore di connessione al server");
        }
    };

    return (
        <>
            <div className="container login">
                <div className="logo-login">
                    <img src="/bot-icon.png" alt="Bot"/>
                </div>
                <div className="login-title d-title-font">Benvenuto in LawBot</div>
                <div className="login-subtitle">Per accedere al chatbot inserisci la tua chiave di accesso</div>
                {error && <p style={{ color: "red" }}>{error}</p>}                    
                <form className="input-box-login" onSubmit={handleLogin}>
                    <input className='input' type="password" placeholder="La tua chiave" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} required />
                    <button className="submit-login d-title-font" type="submit">Accedi</button>
                </form>
            </div>
        </>
    );
};

export default Login;