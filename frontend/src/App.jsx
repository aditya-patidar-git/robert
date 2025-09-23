// App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Mvp from "./pages/Mvp"


function App() {
  return (
    <Router>
      <Routes>
        {/* Default route */}
        <Route path="/" element={<Home />} />
        <Route path="/mvp" element={<Mvp />} />
      </Routes>
    </Router>
  );
}

export default App;
