import { useAuth } from '../contexts/AutoContext';
import {useEffect,useState} from "react";
import {db} from '../firebase/config'
import {collection,query,where,getDocs,onSnapshot} from 'firebase/firestore';

export default function Header() {
  const { user } = useAuth();
  const [dateTime,setDateTime]=useState(new Date());
  const [cashierName,setCashierName] = useState(null);
  
  useEffect(()=>{
    const interval =setInterval(()=>{
      setDateTime(new Date());
    },1000);
    return ()=>clearInterval(interval);
  },[]);

 useEffect(() => {
  const attendanceQuery = query(
    collection(db, "cashierAttendance"),
    where("isOpen", "==", true)
  );

  const unsubscribe = onSnapshot(
    attendanceQuery,
    async (snapshot) => {
      if (!snapshot.empty) {
        const attendanceData = snapshot.docs[0].data();
        const nameFromAttendance = attendanceData.cashierName?.trim();
        if (nameFromAttendance && nameFromAttendance.toLowerCase() !== "cashier") {
          setCashierName(nameFromAttendance);
          return;
        }

        // If no name in attendance, fallback to users_01
        const empId = attendanceData.cashierId;
        const usersQuery = query(
          collection(db, "users_01"),
          where("employeeID", "==", empId)
        );
        const usersSnapshot = await getDocs(usersQuery);
        if (!usersSnapshot.empty) {
          const userData = usersSnapshot.docs[0].data();
          const fallbackName = userData.name?.trim();
          setCashierName(fallbackName || "Cashier");
        } else {
          setCashierName("Cashier");
        }
      } else {
        // No open cashier
        setCashierName(null);
      }
    },
    (error) => {
      console.error("Error listening to cashierAttendance:", error);
      setCashierName(null);
    }
  );

  return () => unsubscribe(); // Clean up
}, []);

  const formattedDate = dateTime.toLocaleDateString();
  const formattedTime = dateTime.toLocaleTimeString();

  return (
    <div className="bg-gray-800 text-white flex justify-between items-center h-[60px] px-4">
      <h2 className="text-1xl sm:text21xl md:text-2xl font-bold">Bhookie POS</h2>
  
      <div className="flex gap-4 sm:gap-6 md:gap-9 items-center text-gray-300 text-sm sm:text-base">
        {cashierName && (
  <div className="text-white flex flex-row items-center gap-4 text-sm sm:text-base">
  {/* Greeting */}
  <span className="text-lg font-semibold flex items-center gap-1">
    <span role="img" aria-label="waving hand">👋</span> Hi {cashierName}!
  </span>

  {/* Date & Time */}
  <div className="text-gray-300 text-sm sm:text-base font-medium flex gap-2">

    <span>{formattedDate}</span>
    <span>{formattedTime}</span>
  </div>
</div>

)}

      </div>
    </div>
  );
}  
