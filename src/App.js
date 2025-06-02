import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AutoContext";
import Login from "./components/Login";
import POS from "./components/POS";
import ManagerScreen from "./components/ManagerScreen";
import ManagerLogin from "./components/ManagerLogin"
import PaymentScreen from "./components/PaymentScreen.jsx";
import Report from "./components/Report.jsx";
import Help from "./components/Help.jsx"
import RecallPage from "./components/RecallPage.jsx";
import RefundPage from "./components/RefundPage.jsx";

export default function App() {
  return (
    
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/help" element={<Help />} />
          <Route path="/employee-login" element={<Login />} /> 
          <Route path="/" element={<POS />} />
          <Route path="/manager-login" element={<ManagerLogin />} />
          <Route path="/manager" element={<ManagerScreen />} />
          <Route path="/PaymentScreen" element={<PaymentScreen />} />         
          <Route path="/Report" element={<Report />} />
          <Route path="/recall-orders" element={<RecallPage/>}/>
          <Route path="/refund-orders" element={<RefundPage/>}/>
        </Routes>
      </AuthProvider>
    </Router>
    
  );
}
