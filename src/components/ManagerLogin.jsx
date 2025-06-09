import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AutoContext";
import { db } from "../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const roleMap = {
  cash01: "cashier",
  manage01: "manager",
  cashier: "cashier",
  manager: "manager",
  teamleader:"teamleader",
  admin:"admin"
};

export default function ManagerLogin() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, logout } = useAuth();

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      logout();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [logout]);

  const handleLogin = async () => {
    const trimmedCode = code.trim();
  
    if (!trimmedCode) {
      alert("Please enter an employee ID");
      return;
    }
  
    setLoading(true);
  
    try {
      const usersRef = collection(db, "users_01");
      const q = query(usersRef, where("employeeID", "==", trimmedCode));
      const querySnapshot = await getDocs(q);
  
      console.log("Searching for employeeID:", JSON.stringify(trimmedCode)); // Enhanced debug
  
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        console.log("Found user document:", JSON.stringify(userData, null, 2)); // Better logging
  
        // Case-insensitive role check
        const roleCode = userData.role?.toLowerCase().trim(); // Convert to lowercase and trim
        const role = roleMap[Object.keys(roleMap).find(
          key => key.toLowerCase() === roleCode
        )];
  
        if (role) {
          setUser({ 
            id: userDoc.id, 
            employeeID: userData.employeeID,
            ...userData, 
            role 
          });
  
          if (role === "manager" || role === "admin" || role=== "teamleader") {
            navigate("/manager");
          } else {
            navigate("/"); // Default redirect for other roles
          }
        } else {
          alert(`Role "${userData.role}" not recognized`);
        }
      } else {
        alert("No employee found with this ID. Please check the ID and try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExitClick = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
      <button
        onClick={handleExitClick}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
      >
        &times;
      </button>
      <div className="bg-white shadow-md p-6 rounded w-full max-w-sm">
        <h2 className="text-2xl font-semibold mb-4 text-center">Manager Login</h2>
        <form onSubmit={(e)=>{e.preventDefault(); handleLogin();}}>
        <input
          type="text"
          placeholder="Enter employee id"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={8}
          className="p-2 border border-gray-300 rounded w-full mb-4 text-center"
        />
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        </form>
      </div>
    </div>
  );
}