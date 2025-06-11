import { useAuth } from "../contexts/AutoContext";
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  setDoc,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  addDoc,
  runTransaction,
  arrayUnion,
  serverTimestamp,
  newDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useNavigate } from "react-router-dom";

const roleMap = {
  cash01: "cashier",
  teammeber: "teammember",
  teamleader: "teamleader",
  admin: "admin",
  // Add other role mappings if needed
};

export default function ManagerScreen() {
  const navigate = useNavigate(); // Initialize navigate
  const [activeTab, setActiveTab] = useState("Orders");
  const [orders, setOrders] = useState([]);
  const [selectedItemInfo, setSelectedItemInfo] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [empId, setEmpId] = useState("");
  const [attendanceMessages, setAttendanceMessages] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [cashierLoading, setCashierLoading] = useState(false);
  const [cashierCode, setCashierCode] = useState("");
  const [amounts, setAmounts] = useState({});
  const [cashierId, setCashierId] = useState("");
  const [cashierStatus, setCashierStatus] = useState("");
  const [sessionDocId, setSessionDocId] = useState(null);
  const { setUser, logout } = useAuth();
  const [searchEmployeeTerm, setSearchEmployeeTerm] = useState("");
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    // Use local date components instead of ISO string
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrderAsc, setSortOrderAsc] = useState(true);
  const [selectedOrderInfo, setSelectedOrderInfo] = useState(null);

  // useEffect for handling page close/navigation away
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Logout the user when the page is closed or navigated away from
      logout();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [logout]);

  // Print order function similar to KOTPanel.jsx
  const handlePrintOrder = (order) => {
    try {
      let pointsToDeduct = 0;
      let updatedPoints = 0;

      // Prepare highlighted order ID string
      const fullOrderId = order.kot_id || order.id || "";
      const orderIdPrefix = fullOrderId.slice(0, -3);
      const orderIdLastThree = fullOrderId.slice(-3);
      const highlightedOrderId = `${orderIdPrefix}<span style="color: red; font-weight: bold;">${orderIdLastThree}</span>`;

      const printContent = `
  <div style="
    width: 280px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #000;
    padding: 5px;
  ">
      <div style="text-align: center; margin-bottom: 5px;">
        <img src="/logo192.png" alt="Logo" style="max-width: 100px; margin-bottom: 10px;" />
        <h3 style="text-align: center; margin: 0; padding: 5px 0;">Order</h3>
      </div>
      <div style="text-align: left; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Order ID:</strong></span>
          <span>${highlightedOrderId}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Cashier:</strong></span>
          <span>${order.cashierName || ""} (${order.cashierId || ""})</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Order Type:</strong></span>
          <span>${order.orderType === "dine-in" ? "Dine In" : "Takeaway"}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Time:</strong></span>
          <span>${
            order.date?.toDate?.().toLocaleString() ||
            new Date().toLocaleString()
          }</span>
        </div>

        ${
          order.customerID
            ? `<div style="display: flex; justify-content: space-between;">
                <span><strong>${
                  order.isEmployee ? "Employee" : "Customer"
                }:</strong></span>
                <span>${order.customerName || ""} (${
                order.customerID || ""
              })</span>
              </div>`
            : ""
        }

        ${
          order.isEmployee
            ? `<div style="display: flex; justify-content: space-between;">
                <span><strong>Meal Credits Used:</strong></span>
                <span>£${(order.creditsUsed || 0).toFixed(2)}</span>
              </div>
              ${
                (order.cashDue || 0) > 0
                  ? `<div style="display: flex; justify-content: space-between;">
                      <span><strong>Cash Due:</strong></span>
                      <span>£${(order.cashDue || 0).toFixed(2)}</span>
                    </div>`
                  : ""
              }`
            : ""
        }

        <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px dashed #000;">Item</th>
              <th style="text-align: center; border-bottom: 1px dashed #000;">Qty</th>
              <th style="text-align: right; border-bottom: 1px dashed #000;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${
              order.items
                ?.map((item) => {
                  const isUpgrade = item.isUpgrade;
                  if (isUpgrade) return "";

                  const upgrade = order.items.find(
                    (i) => i.parentItem === item.id && i.isUpgrade
                  );
                  let rows = `
                  <tr>
                    <td style="padding: 2px 0;">${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">£${item.price.toFixed(
                      2
                    )}</td>
                  </tr>`;

                  if (upgrade) {
                    rows += `
                  <tr>
                    <td style="padding: 2px 0; font-size: 11px; color: #555;">
                      ↑ ${item.name} Upgraded to ${upgrade.itemName.replace(
                      "Upgrade to ",
                      ""
                    )}
                    </td>
                    <td style="text-align: center;"></td>
                    <td style="text-align: right;">+£${upgrade.price.toFixed(
                      2
                    )}</td>
                  </tr>
                  <tr>
                    <td style="padding: 2px 0; font-weight: bold;">
                      Total for ${item.name
                        .replace(/\([^)]*\)/g, "")
                        .replace(/\b(regular|large|medium)\b/gi, "")
                        .trim()}
                    </td>
                    <td style="text-align: center;"></td>
                    <td style="text-align: right;">= £${(
                      item.price + upgrade.price
                    ).toFixed(2)}</td>
                  </tr>`;
                  }

                  return rows;
                })
                .join("") || ""
            }
          </tbody>
        </table>

        <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

        <div style="display: flex; justify-content: space-between;">
          <span><strong>Sub Total:</strong></span>
          <span>£${(order.subTotal || 0).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Discount:</strong></span>
          <span>£${
            order.isEmployee
              ? (order.creditsUsed || 0).toFixed(2)
              : ((order.subTotal || 0) - (order.total || 0)).toFixed(2)
          }</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span><strong>Total:</strong></span>
          <span>£${(order.total || 0).toFixed(2)}</span>
        </div>

        ${
          order.customerID && !order.isEmployee && (order.discount || 0) > 0
            ? `<p style="color: green;"> Discount applied: £${pointsToDeduct.toFixed(
                2
              )} (Remaining Points: ${updatedPoints})</p>`
            : ""
        }

        ${
          order.customerID && !order.isEmployee
            ? `<p><strong>Earned Points:</strong> ${
                order.earnedPoints || 0
              }</p>`
            : ""
        }

        <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

        <p style="text-align: center;">--- Thank You ---</p>
      </div>
    </div>`;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`
    <html>
      <head>
        <title>Print KOT</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 280px;
            padding: 10px;
            color: #000;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 2px 0;
          }
          th {
            border-bottom: 1px dashed #000;
          }
          td:nth-child(2), td:nth-child(3) {
            text-align: center;
          }
          td:nth-child(3) {
            text-align: right;
          }
          hr {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .sauces {
            font-size: 10px;
            color: #555;
          }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${printContent}
      </body>
    </html>
  `);
        printWindow.document.close();
      }

      // Clear selected order info after printing
      setSelectedOrderInfo(null);
    } catch (error) {
      console.error("Error in print generation:", error);
      alert("Failed to print order. Please try again.");
    }
  };

  const handleOpenCashier = async () => {
    const trimmedCode = cashierCode.trim();
    if (!trimmedCode) {
      setCashierStatus("Please enter a valid employee ID.");
      return;
    }

    setCashierLoading(true);
    setCashierStatus("Authenticating...");

    try {
      // 1. Query users collection
      const usersRef = collection(db, "users_01");
      const userQuery = query(usersRef, where("employeeID", "==", trimmedCode));
      const querySnapshot = await getDocs(userQuery);

      if (querySnapshot.empty) {
        setCashierStatus("Invalid employee ID.");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // 2. Check active status
      if (userData.active !== true) {
        setCashierStatus("User is inactive.");
        return;
      }

      // 3. Validate role
      const role = userData.role;
      if (!role || !roleMap[role]) {
        setCashierStatus("User role not recognized.");
        return;
      }

      // 4. Check existing session using isSignedIn
      const attendanceRefCheck = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", trimmedCode),
        where("isSignedIn", "==", true)
      );
      const attendanceSnapCheck = await getDocs(attendanceRefCheck);

      if (!attendanceSnapCheck.empty) {
        setCashierStatus("Cashier is already opened.");
        return;
      }

      // 5. Create session history
      const sessionRef = doc(collection(db, "sessionHistory"));
      await setDoc(sessionRef, {
        userId: trimmedCode,
        cashierName: userData.name,
        loginTime: serverTimestamp(),
        role: role,
        logoutTime: null,
      });

      // 6. Update cashier attendance
      const attendanceRef = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", trimmedCode)
      );
      const attendanceSnap = await getDocs(attendanceRef);

      if (attendanceSnap.empty) {
        const newAttendanceRef = doc(collection(db, "cashierAttendance"));
        await setDoc(newAttendanceRef, {
          cashierId: trimmedCode,
          cashierName: userData.name || "Unnamed Cashier",
          isSignedIn: true, // Now signed in for shift
          isOpen: false, // Till not open yet
          openTimes: [],
          closeTimes: [],
          signInTime: serverTimestamp(),
        });
      } else {
        const existingDoc = attendanceSnap.docs[0];
        await updateDoc(doc(db, "cashierAttendance", existingDoc.id), {
          isSignedIn: true,
          isOpen: false,
          signInTime: serverTimestamp(),
        });
      }

      // Update UI state
      setUser({
        id: trimmedCode,
        ...userData,
        role: role,
      });
      setCashierId(trimmedCode); // Set active cashier
      setCashierStatus(`Cashier ${userData.name} Opened successfully.`);
      setCashierCode("");
    } catch (error) {
      console.error("Open Cashier error:", error);
      setCashierStatus("Failed to Open cashier.");
    } finally {
      setCashierLoading(false);
    }
  };

  // Close Cashier (end shift)
  const handleCloseCashier = async () => {
    const trimmedCode = cashierCode.trim();
    if (!trimmedCode) {
      setCashierStatus("Please enter Cashier ID.");
      return;
    }

    setCashierStatus("Processing...");
    setCashierLoading(true);

    try {
      // 1. Find active session
      const sessionQuery = query(
        collection(db, "sessionHistory"),
        where("userId", "==", trimmedCode),
        where("logoutTime", "==", null)
      );
      const sessionSnap = await getDocs(sessionQuery);

      if (sessionSnap.empty) {
        setCashierStatus("No active session found.");
        return;
      }

      const sessionRef = doc(db, "sessionHistory", sessionSnap.docs[0].id);

      // 2. Find cashier attendance
      const attQuery = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", trimmedCode),
        where("isSignedIn", "==", true)
      );
      const attSnap = await getDocs(attQuery);

      if (attSnap.empty) {
        setCashierStatus("Cashier is not Open.");
        return;
      }

      const attDoc = attSnap.docs[0];
      const attRef = doc(db, "cashierAttendance", attDoc.id);
      const data = attDoc.data();

      // 3. Close till if open
      if (data.isOpen) {
        await updateDoc(attRef, {
          isOpen: false,
          closeTimes: arrayUnion(Timestamp.now()),
        });
      }

      // 4. Mark as signed out
      await updateDoc(attRef, {
        isSignedIn: false,
      });

      // 5. Update session history
      await updateDoc(sessionRef, {
        logoutTime: serverTimestamp(),
      });

      // 6. Close any open cash sessions
      const cashSessionQuery = query(
        collection(db, "cashSessions"),
        where("cashierId", "==", trimmedCode),
        where("isClosed", "==", false)
      );
      const cashSessionSnap = await getDocs(cashSessionQuery);

      if (!cashSessionSnap.empty) {
        const sessionDoc = cashSessionSnap.docs[0];
        const cashRef = doc(db, "cashSessions", sessionDoc.id);
        await updateDoc(cashRef, {
          isClosed: true,
          closedAt: Timestamp.now(),
          closedBy: trimmedCode,
        });
      }

      // Clear active cashier if closing current session
      if (cashierId === trimmedCode) {
        setCashierId("");
      }

      setCashierStatus("Cashier Closed successfully.");
      setCashierCode("");
    } catch (error) {
      console.error("Closing error:", error);
      setCashierStatus("Failed to Close cashier.");
    } finally {
      setCashierLoading(false);
    }
  };

  // Sign In Cashier (open till)
  const handleSignInCashier = async () => {
    if (!cashierId) {
      alert("No active cashier session.");
      return;
    }

    try {
      // 1. Verify active cashier session
      const q = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", cashierId),
        where("isSignedIn", "==", true)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Cashier is not Opened.");
        return;
      }

      const attendanceDoc = snapshot.docs[0];
      const attendanceRef = doc(db, "cashierAttendance", attendanceDoc.id);
      const cashierData = attendanceDoc.data();

      // 2. Prevent reopening if already open
      if (cashierData.isOpen) {
        alert("Cashier is already Signed In.");
        return;
      }

      // 3. Update to open till
      await updateDoc(attendanceRef, {
        isOpen: true,
        openTimes: arrayUnion(Timestamp.now()),
      });

      // 4. Handle cash sessions
      const csQ = query(
        collection(db, "cashSessions"),
        where("cashierId", "==", cashierId),
        where("isClosed", "==", false)
      );
      const csSnap = await getDocs(csQ);

      if (!csSnap.empty) {
        const csDoc = csSnap.docs[0];
        const csRef = doc(db, "cashSessions", csDoc.id);
        await updateDoc(csRef, { isPaused: false });
      }

      alert("Till opened successfully.");
    } catch (error) {
      console.error("Sign In error:", error);
      alert("Failed to Sign In Cashier.");
    }
  };

  // Sign Out Cashier (close till)
  const handleSignOutCashier = async () => {
    console.log("id :", cashierCode);
    if (!cashierId) {
      alert("No active cashier session.");
      return;
    }

    try {
      // 1. Verify active session
      const q = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", cashierId),
        where("isSignedIn", "==", true)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Cashier is not Opened.");
        return;
      }

      const docSnapshot = snapshot.docs[0];
      const attendanceRef = doc(db, "cashierAttendance", docSnapshot.id);
      const cashierData = docSnapshot.data();

      // 2. Prevent closing if already closed
      if (!cashierData.isOpen) {
        alert("Cashier is already Signed Out.");
        return;
      }

      // 3. Close till
      await updateDoc(attendanceRef, {
        isOpen: false,
        closeTimes: arrayUnion(Timestamp.now()),
      });

      // 4. Pause cash session
      const csQ = query(
        collection(db, "cashSessions"),
        where("cashierId", "==", cashierId),
        where("isClosed", "==", false)
      );
      const csSnap = await getDocs(csQ);

      if (!csSnap.empty) {
        const csDoc = csSnap.docs[0];
        const csRef = doc(db, "cashSessions", csDoc.id);
        await updateDoc(csRef, { isPaused: true });
      }

      alert("Cashier Signed Out successfully.");
    } catch (error) {
      console.error("Sign Out error:", error);
      alert("Failed to Sign Out Cashier.");
    }
  };

  // Daily reset check
  const checkDailyReset = async () => {
    try {
      const lastResetRef = doc(db, "system", "lastReset");
      const lastResetSnap = await getDoc(lastResetRef);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const needsReset =
        !lastResetSnap.exists() ||
        lastResetSnap.data().date.toDate().toDateString() !==
          today.toDateString();

      if (needsReset) {
        const employeesSnap = await getDocs(
          query(
            collection(db, "users_01"),
            where("role", "==", "teammember" || "teamleader" || "manager")
          )
        );
        const updatePromises = [];

        for (const empDoc of employeesSnap.docs) {
          const phone = empDoc.id;
          const mealRef = doc(db, "users_01", phone, "meal", "1");
          const mealSnap = await getDoc(mealRef);

          if (mealSnap.exists()) {
            const defaultCredits = mealSnap.data().defaultMealCredits;
            updatePromises.push(
              updateDoc(mealRef, { mealCredits: defaultCredits })
            );
          }
        }

        updatePromises.push(
          updateDoc(lastResetRef, { date: today }, { merge: true })
        );
        await Promise.all(updatePromises);
        console.log("Daily credits reset completed");
      }
    } catch (err) {
      console.error("Daily reset error:", err);
    }
  };

  // const handleRefund = async (orderId, itemId, refundAmount) => {
  //   const kotRef = doc(db, "KOT", orderId);
  //   const kotSnap = await getDoc(kotRef);
  //   if (!kotSnap.exists()) return;

  //   const data = kotSnap.data();
  //   const updatedItems = data.items.filter((item) => item.id !== itemId);
  //   const newAmount = data.amount - refundAmount;

  //   if (updatedItems.length === 0) {
  //     await deleteDoc(kotRef);
  //   } else {
  //     await updateDoc(kotRef, { items: updatedItems, amount: newAmount });
  //   }

  //   setSelectedItemInfo(null);
  //   fetchOrders();
  // };

  // const handleVoid = async (orderId) => {
  //   await deleteDoc(doc(db, "KOT", orderId));
  //   setSelectedItemInfo(null);
  //   fetchOrders();
  // };

  const fetchEmployees = async () => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, "users_01"),
          where("role", "==", "teammember" || "teamleader" || "manager")
        )
      );
      const today = new Date();
      const monthDocId = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      const dayKey = String(today.getDate()).padStart(2, "0");

      const employeePromises = snapshot.docs.map(async (empDoc) => {
        const phone = empDoc.id;
        const data = empDoc.data();
        const attendanceDocRef = doc(
          db,
          "users_01",
          phone,
          "attendance",
          monthDocId
        );
        const attendanceSnap = await getDoc(attendanceDocRef);

        let isClockedIn = false;
        if (attendanceSnap.exists()) {
          const attendanceData = attendanceSnap.data();
          const todayAttendance = attendanceData?.days?.[dayKey] || {};
          isClockedIn = todayAttendance.isClockedIn || false;
        }

        const mealRef = doc(db, "users_01", phone, "meal", "1");
        const mealSnap = await getDoc(mealRef);
        const mealData = mealSnap.exists() ? mealSnap.data() : {};

        return {
          id: phone, // Document ID is phone number
          employeeID: data.employeeID, // From document field
          name: data.name,
          phone: phone,
          role: data.role,
          active: data.active,
          meal: mealSnap.exists() ? mealSnap.data() : {},
          isClockedIn: attendanceSnap.exists()
            ? attendanceSnap.data().days?.[dayKey]?.isClockedIn || false
            : false,
        };
      });

      const resolvedData = await Promise.all(employeePromises);
      setEmployees(resolvedData);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };
  const filteredEmployees = employees.filter(employee => {
  const searchTerm = searchEmployeeTerm.toLowerCase();
  return (
    employee.name.toLowerCase().includes(searchTerm) ||
    employee.employeeID.toLowerCase().includes(searchTerm)
  );
});

  // In ManagerScreen component
  const fetchOrders = async () => {
    try {
      let q = collection(db, "KOT");

      if (filterDate) {
        // Parse filterDate as LOCAL date (not UTC)
        const [year, month, day] = filterDate.split("-");
        const selectedDate = new Date(year, month - 1, day);

        // Start of day (00:00:00 LOCAL time)
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        // End of day (23:59:59.999 LOCAL time)
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Convert to Firestore Timestamps
        const startTimestamp = Timestamp.fromDate(startOfDay);
        const endTimestamp = Timestamp.fromDate(endOfDay);

        q = query(
          q,
          where("date", ">=", startTimestamp),
          where("date", "<=", endTimestamp)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };
  {
    /*
  // Attendance Handlers
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const handleClockIn = async () => {
    if (!empId) return alert("Please enter Employee ID");

    try {
      const empRef = doc(db, "Employees", empId);
      const empSnap = await getDoc(empRef);
      if (!empSnap.exists()) return alert("Employee not found");
      const empName = empSnap.data().name;

      const today = new Date();
      const monthDocId = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      const dayKey = String(today.getDate()).padStart(2, "0");

      const monthRef = doc(db, "Employees", empId, "attendance", monthDocId);

      const checkInTimestamp = Timestamp.now();
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(monthRef);
        const newSession = { checkIn: Timestamp.now(), checkOut: null };

        // Check existing clock status
        const existingDay = docSnap.exists()
          ? docSnap.data().days?.[dayKey]
          : null;
        if (existingDay?.isClockedIn) {
          throw new Error("You must clock out before clocking in again.");
        }

        if (!docSnap.exists()) {
          transaction.set(monthRef, {
            days: {
              [dayKey]: {
                sessions: [newSession],
                isClockedIn: true,
              },
            },
            metadata: {
              created: serverTimestamp(),
              lastUpdated: serverTimestamp(),
            },
          });
        } else {
          transaction.update(monthRef, {
            [`days.${dayKey}.sessions`]: arrayUnion(newSession),
            [`days.${dayKey}.isClockedIn`]: true,
            "metadata.lastUpdated": serverTimestamp(),
          });
        }
      });

      setAttendanceMessages((prev) => [
        ...prev,
        `✅ Clocked in ${
          empSnap.data().name
        } at ${new Date().toLocaleTimeString()}`,
      ]);
      // Save attendance log with check-in only
      await saveSessionToAttendanceLogs(empId, empName, checkInTimestamp, null);
      setEmpId("");
    } catch (err) {
      console.error("Clock In error:", err);
      alert(err.message || "Clock In failed");
    }
  };

  const handleClockOut = async () => {
    if (!empId) return alert("Please enter Employee ID");

    try {
      const empRef = doc(db, "Employees", empId);
      const empSnap = await getDoc(empRef);
      if (!empSnap.exists()) return alert("Employee not found");

      const empName = empSnap.data().name;
      const today = new Date();
      const monthDocId = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      const dayKey = String(today.getDate()).padStart(2, "0");

      const monthRef = doc(db, "Employees", empId, "attendance", monthDocId);

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(monthRef);
        if (!docSnap.exists()) return;

        const dayData = docSnap.data().days?.[dayKey] || {};
        if (!dayData.isClockedIn) {
          throw new Error("You are not currently clocked in.");
        }

        const sessions = [...dayData.sessions];
        const lastSession = sessions[sessions.length - 1];

        if (lastSession && !lastSession.checkOut) {
          lastSession.checkOut = Timestamp.now();
          // Now call your new save-to-log function here
          await saveSessionToAttendanceLogs(
            empId,
            empName,
            lastSession.checkIn,
            lastSession.checkOut
          );
        }

        transaction.update(monthRef, {
          [`days.${dayKey}.sessions`]: sessions,
          [`days.${dayKey}.isClockedIn`]: false,
          "metadata.lastUpdated": serverTimestamp(),
        });
      });

      setAttendanceMessages((prev) => [
        ...prev,
        `✅ Clocked out ${empId} at ${new Date().toLocaleTimeString()}`,
      ]);
      setEmpId("");
    } catch (err) {
      console.error("Clock Out error:", err);
      alert(err.message || "Clock Out failed");
    }
  };

  const handleShowLogs = async () => {
    try {
      const today = getTodayDate();
      const employeesSnap = await getDocs(collection(db, "Employees"));
      const logs = [];

      for (const empDoc of employeesSnap.docs) {
        const monthDocId = `${new Date().getFullYear()}-${String(
          new Date().getMonth() + 1
        ).padStart(2, "0")}`;
        const monthRef = doc(
          db,
          "Employees",
          empDoc.id,
          "attendance",
          monthDocId
        );
        const monthSnap = await getDoc(monthRef);

        if (monthSnap.exists()) {
          const dayKey = String(new Date().getDate()).padStart(2, "0");
          const sessions = monthSnap.data().days?.[dayKey]?.sessions || [];

          sessions.forEach((session) => {
            const checkIn =
              session.checkIn?.toDate().toLocaleTimeString() || "—";
            const checkOut =
              session.checkOut?.toDate().toLocaleTimeString() || "—";
            let duration = "Incomplete";

            if (session.checkIn && session.checkOut) {
              const diff = session.checkOut.toDate() - session.checkIn.toDate();
              duration = `${Math.floor(diff / 3600000)}h ${Math.floor(
                (diff % 3600000) / 60000
              )}m`;
            }

            logs.push({
              empName: empDoc.data().name,
              checkInStr: checkIn,
              checkOutStr: checkOut,
              worked: duration,
            });
          });
        }
      }

      setTodayLogs(logs);
      setLogsVisible(!logsVisible);
    } catch (err) {
      console.error("Fetch logs error:", err);
      alert("Failed to load attendance logs");
    }
  };

  const saveSessionToAttendanceLogs = async (empId, empName, checkIn, checkOut) => {
    try {
      const todayDate = getTodayDate();
      const logDocRef = doc(db, "AttendanceLogs", todayDate);
      const logDocSnap = await getDoc(logDocRef);
  
      // Calculate worked hours
      let worked = "Incomplete";
      if (checkIn && checkOut) {
        const diff = checkOut.toDate() - checkIn.toDate();
        worked = `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
      }
  
      const sessionData = {
        empId,
        empName,
        checkIn: checkIn ? checkIn.toDate().toLocaleTimeString() : "—",
        checkOut: checkOut ? checkOut.toDate().toLocaleTimeString() : "—",
        worked,
        sessionTimestamp: new Date().toISOString(), // optional, to track when this log was created
      };
  
      // If AttendanceLogs doc for today doesn't exist, create it
      if (!logDocSnap.exists()) {
        await setDoc(logDocRef, {});
      }
  
      const logsRef = collection(logDocRef, "logs");
  
      // Always add a new log (don't overwrite)
      await addDoc(logsRef, sessionData);
      console.log("Attendance session log created ✅");
  
    } catch (err) {
      console.error("Error saving attendance session log:", err);
    }
  };
  
*/
  }
  useEffect(() => {
    if (activeTab === "Orders") fetchOrders();
    if (activeTab === "Staff Meal") {
      checkDailyReset().then(fetchEmployees);
    }
  }, [activeTab, filterDate]);

  const filteredOrders = orders.filter((order) => {
    const query = searchTerm.toLowerCase();
    const orderDate = order.date?.toDate?.().toISOString().split("T")[0];

    return (
      (!filterDate || orderDate === filterDate) &&
      (!searchTerm ||
        order.kot_id?.toString()?.toLowerCase().includes(query) ||
        order.customerID?.toString()?.toLowerCase().includes(query) ||
        order.amount?.toString()?.toLowerCase().includes(query))
    );
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const idA = a.kot_id || a.id || "";
    const idB = b.kot_id || b.id || "";
    return sortOrderAsc ? idA.localeCompare(idB) : idB.localeCompare(idA);
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6 space-y-4 fixed top-0 left-0 bottom-0 z-20">
        <h2 className="text-2xl font-bold mb-6">Manager Panel</h2>
        <nav className="space-y-2">
          <button
            className={`block w-full text-left px-4 py-2 rounded ${
              activeTab === "Orders" ? "bg-gray-700" : "hover:bg-gray-700"
            }`}
            onClick={() => setActiveTab("Orders")}
          >
            Orders
          </button>
          <button
            className={`block w-full text-left px-4 py-2 rounded ${
              activeTab === "Staff Meal" ? "bg-gray-700" : "hover:bg-gray-700"
            }`}
            onClick={() => setActiveTab("Staff Meal")}
          >
            Staff Meal
          </button>
          <button
            className={`block w-full text-left px-4 py-2 rounded ${
              activeTab === "Cash Management"
                ? "bg-gray-700"
                : "hover:bg-gray-700"
            }`}
            onClick={() => setActiveTab("Cash Management")}
          >
            Cashier Control Panel
          </button>
        </nav>

        {/* Fixed Back Button */}
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="absolute bottom-4 left-6 block w-[215px] text-left px-4 py-2 rounded text-white bg-gray-800 hover:bg-gray-700"
        >
          Back
        </button>
      </aside>

      <main className="ml-64 flex-1 overflow-y-auto p-6 h-screen">
        <h1 className="text-3xl font-bold mb-4">Manager Screen</h1>

        {activeTab === "Orders" && (
          <div>
            <div className="mb-4">
              <label className="block mb-2 font-medium">Filter by Date:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border p-2 rounded"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Search Orders:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order ID, Customer ID, Amount..."
                  className="border p-2 rounded w-full"
                />
                <button
                  onClick={() => {}}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Search
                </button>
              </div>
            </div>

            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Date</th>
                  <th
                    className="p-2 border cursor-pointer select-none"
                    onClick={() => setSortOrderAsc(!sortOrderAsc)}
                  >
                    Order ID (KOT ID)
                    <span className="ml-1">{sortOrderAsc ? "↑" : "↓"}</span>
                  </th>
                  <th className="p-2 border">Customer ID</th>
                  <th className="p-2 border">User ID</th>
                  <th className="p-2 border">Total Items</th>
                  <th className="p-2 border">Total Amount</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sortedOrders.length > 0 ? (
                  sortedOrders.map((order) => {
                    const orderId = order.id || order.kot_id;
                    const totalItems = order.items?.reduce(
                      (total, item) => total + (item.quantity || 0),
                      0
                    );
                    const isFullyRefunded = order.refunded;
                    const isPartiallyRefunded =
                      order.refundedAmount > 0 && !order.refunded;
                    const isSelected = selectedOrderInfo?.orderId === orderId;

                    return (
                      <React.Fragment key={orderId}>
                        <tr
                          className={`text-center border-t cursor-pointer ${
                            isSelected ? "bg-gray-100" : ""
                          }`}
                          onClick={() =>
                            setSelectedOrderInfo(
                              isSelected
                                ? null
                                : {
                                    orderId,
                                    order,
                                  }
                            )
                          }
                        >
                          <td className="p-2 border">
                            {order.date?.toDate?.().toLocaleString() || "N/A"}
                          </td>
                          <td className="p-2 border">
                            {order.kot_id || order.id}
                          </td>
                          <td className="p-2 border">
                            {order.customerID || "N/A"}
                          </td>

                          <td className="p-2 border">
                            {order.user_id || "N/A"}
                          </td>
                          <td className="p-2 border">{totalItems || 0}</td>
                          <td className="p-2 border">
                            £
                            {(
                              order.amount - (order.refundedAmount || 0)
                            ).toFixed(2)}
                            {isPartiallyRefunded && (
                              <span className="text-yellow-600 text-xs block">
                                (Refunded: £{order.refundedAmount.toFixed(2)})
                              </span>
                            )}
                            {isFullyRefunded && (
                              <span className="text-red-600 text-xs block">
                                FULLY REFUNDED
                              </span>
                            )}
                          </td>
                          <td className="p-2 border">
                            <div className="flex gap-2 justify-center">
                              {/* <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (order.refunded) return;
                                  navigate("/", {
                                    state: {
                                      refundOrder: order,
                                      originalOrderId: order.id,
                                    },
                                  });
                                }}
                                className={`${
                                  order.refunded
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-red-500 hover:bg-red-600"
                                } text-white px-3 py-1 rounded`}
                                disabled={order.refunded}
                              >
                                {order.refunded ? "Refunded" : "Refund"}
                              </button> */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintOrder(order);
                                }}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                              >
                                Print
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className="bg-gray-50 text-center">
                            <td colSpan={7} className="p-4 text-left">
                              <h4 className="font-semibold mb-2">
                                Order Items:
                              </h4>
                              {order.items && order.items.length > 0 ? (
                                <ul className="list-disc list-inside">
                                  {order.items.map((item, idx) => (
                                    <li key={idx}>
                                      {item.name} × {item.quantity}
                                      {item.refundedQuantity > 0 && (
                                        <span className="text-red-600">
                                          (Refunded: {item.refundedQuantity})
                                        </span>
                                      )}
                                      {item.refunded && (
                                        <span className="text-red-600 ml-2">
                                          [FULLY REFUNDED]
                                        </span>
                                      )}
                                      — £
                                      {(item.price * item.quantity).toFixed(2)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No items found for this order.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center">
                      No Orders Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Staff Meal" && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Staff Meal Credits</h3>

            {/* Search Bar */}
            <div className="mb-4">
              <label className="block mb-2 font-medium">
                Search Employees:
              </label>
              <input
                type="text"
                value={searchEmployeeTerm}
                onChange={(e) => setSearchEmployeeTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-200 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Employee</th>
                    <th className="p-2 text-left">ID</th>
                    <th className="p-2 text-left">Credits Left</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Clock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={`border-b hover:bg-gray-100 ${
                        employee.isClockedIn
                          ? "cursor-pointer"
                          : "cursor-not-allowed"
                      }`}
                      onClick={() => {
                        if (employee.isClockedIn) {
                          logout();
                          navigate("/", {
                            state: {
                              selectedEmployee: {
                                id: employee.phone,
                                name: employee.name,
                                EmployeeID: employee.employeeID,
                                phone: employee.phone,
                                mealCredits: employee.meal.mealCredits,
                                isClockedIn: employee.isClockedIn,
                              },
                            },
                          });
                        } else {
                          alert(
                            "Employee must be Clocked-In to use Meal Credits."
                          );
                        }
                      }}
                    >
                      <td className="p-2">{employee.name}</td>
                      <td className="p-2">{employee.employeeID}</td>
                      <td className="p-2">{employee.meal.mealCredits || 0}</td>
                      <td className="p-2">
                        {employee.meal.mealCredits === 0 ||
                        employee.isClockedIn === false ? (
                          <span className="text-red-600 font-medium">
                            Not Available
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {employee.isClockedIn ? (
                          <span className="text-green-600">Clocked In</span>
                        ) : (
                          <span className="text-red-600">Clocked Out</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEmployees.length === 0 && (
                <p className="text-center text-gray-500 mt-4">
                  No employees found
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "Cash Management" && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cashier Login Code
              </label>
              <input
                type="text"
                value={cashierCode}
                onChange={(e) => setCashierCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-md shadow-sm text-black bg-white"
                placeholder="Enter Cashier Login Code"
              />
            </div>

            {/* Status Message */}
            {cashierStatus && (
              <div className="mb-4 text-sm text-gray-700">
                <strong>Status:</strong> {cashierStatus}
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleOpenCashier}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-900"
                disabled={!cashierCode || cashierLoading}
              >
                {cashierLoading ? "Processing..." : "Start Shift"}
              </button>

              <button
                onClick={handleSignInCashier}
                disabled={!cashierId || cashierLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Open Till
              </button>

              <button
                onClick={handleSignOutCashier}
                disabled={!cashierId || cashierLoading}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Close Till
              </button>

              <button
                onClick={handleCloseCashier}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                disabled={!cashierCode || cashierLoading}
              >
                End Shift
              </button>
            </div>
          </div>
        )}

        {activeTab === "Cash" && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold">Cash Management</h3>
            <p className="mt-2 text-gray-600">
              Cash overview panel coming soon!
            </p>
          </div>
        )}
        {/*
        {activeTab === "Attendance" && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">
              Attendance Management
            </h3>

            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Employee ID"
                className="border p-2 rounded flex-1"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
              />
              <button
                onClick={handleClockIn}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Clock In
              </button>
              <button
                onClick={handleClockOut}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Clock Out
              </button>
            </div>

            <div className="mb-4 space-y-2">
              {attendanceMessages.map((msg, index) => (
                <div key={index} className="bg-white p-2 rounded shadow-sm">
                  {msg}
                </div>
              ))}
            </div>

            <button
              onClick={handleShowLogs}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
            >
              {logsVisible ? "Hide Today's Logs" : "Show Today's Logs"}
            </button>

            {logsVisible && (
              <div className="bg-white p-4 rounded shadow">
                <h4 className="text-center font-medium mb-2">
                  Today's Attendance
                </h4>
                <table className="w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="p-2">Employee</th>
                      <th className="p-2">Check-In</th>
                      <th className="p-2">Check-Out</th>
                      <th className="p-2">Hours Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.map((log, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-center">{log.empName}</td>
                        <td className="p-2 text-center">{log.checkInStr}</td>
                        <td className="p-2 text-center">{log.checkOutStr}</td>
                        <td className="p-2 text-center">{log.worked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
          */}
      </main>
    </div>
  );
}
