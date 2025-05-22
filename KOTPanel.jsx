import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { increment, where } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { writeBatch } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import PaymentScreen from "./PaymentScreen";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";

export default function KOTPanel({ kotItems, setKotItems }) {
  const [subTotal, setSubTotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [total, setTotal] = useState(0);
  const [showNumberPad, setShowNumberPad] = useState(false);
  const [isOrderTypeModalOpen, setIsOrderTypeModalOpen] = useState(false);
  const [quantityInput, setQuantityInput] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [kotId, setKotId] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [isPaymentProcessed, setIsPaymentProcessed] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [foundCustomers, setFoundCustomers] = useState([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [employeeMealCredits, setEmployeeMealCredits] = useState(0);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [cashDue, setCashDue] = useState(0);
  const [isEmployee, setIsEmployee] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [isOrderStored, setIsOrderStored] = useState(false);
  const [orderType, setOrderType] = useState("dine-in"); // Default to 'dine-in'
  const location = useLocation();
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const userId = "1234"; // Replace with logged-in user ID
  // const [autoProcessEmployee, setAutoProcessEmployee] = useState(null);

  // Add this useEffect hook

  useEffect(() => {
    if (isPaymentProcessed) {
      handleGenerateKOT();
    }
  }, [isPaymentProcessed]);

  useEffect(() => {
    if (kotItems.length > 0) {
      updateTotals(kotItems);
    }
  }, [kotItems, isEmployee, employeeMealCredits]);

  const allowedItems = [
    "Chicken bites",
    "Chicken Drumsticks",
    "Manchurian bites",
    "Vadapav",
    "Bhaji pav",
    "Veggie Alootikki burger",
    "Chicken burger",
    "Chai",
  ];

  // In KOTPanel.jsx - Update the useEffect for recalled orders
  useEffect(() => {
    if (location.state?.recalledOrder) {
      const order = location.state.recalledOrder;

      // Set KOT items
      setKotItems(order.items);

      // Set customer/employee information
      if (order.isEmployee) {
        setCustomerId(order.employeeId); // Use employee ID for employees
      } else {
        setCustomerId(order.customerId); // Use customer ID for customers
      }
      setOrderType(order.orderType || "dine-in");
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setIsEmployee(order.isEmployee);

      // Set payment details
      setCreditsUsed(order.creditsUsed);
      setCashDue(order.cashDue);

      // Store pending order ID for status update
      setOrderId(order.id);

      // Clear navigation state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.selectedEmployee) {
      const employee = location.state.selectedEmployee;
      // Pre-fill employee details but don't skip item selection
      setCustomerId(employee.EmployeeID);
      setCustomerName(employee.name);
      setCustomerPhone(employee.phone);
      setEmployeeMealCredits(employee.mealCredits);
      setIsEmployee(true);
      setIsCustomerModalOpen(false); // Close customer modal if open

      // Clear the navigation state after processing
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    // Only show loyalty modal for non-employee orders
    if (!isEmployee && !customerId) {
      setIsCustomerModalOpen(false);
    }
  }, [isEmployee, customerId]);

  const handleAutoProcessEmployee = async (employee) => {
    if (employee.isClockedIn) {
      alert("Employee must not be clocked in to use meal credits!");
      return;
    }

    const handlePaymentSelection = () => {
      if (paymentMethod) {
        console.log("Payment method selected:", paymentMethod);
        setIsPaymentModalOpen(false); // Close the modal
      } else {
        alert("Please select a payment method.");
      }
    };

    const onBack = () => {
      // Add your logic here (navigate back, close modal, or other)
      console.log("Back to KOT clicked");
      setIsPaymentModalOpen(false); // Or handle KOT screen logic
    };

    // Set employee details and skip customer modal
    setCustomerId(employee.employeeID);
    setCustomerName(employee.name);
    setCustomerPhone(employee.phone);
    setEmployeeMealCredits(employee.mealCredits);
    setIsEmployee(true);
    setIsCustomerModalOpen(false); // Explicitly close customer modal

    // Open payment modal directly
    setIsPaymentModalOpen(true);
  };

  const updateInventory = async (kotItems) => {
    try {
      // Process each item in the KOT
      for (const item of kotItems) {
        const itemRef = doc(db, "inventory", item.id);
        const itemSnap = await getDoc(itemRef);

        if (itemSnap.exists()) {
          const inventoryData = itemSnap.data();
          const { unitsPerInner, innerPerBox, totalStockOnHand } =
            inventoryData;

          // Calculate total units sold
          const totalUnitsSold = item.quantity;

          // Calculate new stock values
          const newTotalStock = totalStockOnHand - totalUnitsSold;

          // Update inventory
          await updateDoc(itemRef, {
            totalStockOnHand: newTotalStock,
            lastUpdated: Timestamp.now(),
          });

          console.log(
            `Updated inventory for ${item.name}: Deducted ${totalUnitsSold} units`
          );
        } else {
          console.warn(`Inventory item ${item.id} not found`);
        }
      }
    } catch (error) {
      console.error("Error updating inventory:", error);
      throw error;
    }
  };

  const checkStockAvailability = async (items) => {
    try {
      const stockErrors = [];

      for (const item of items) {
        const itemRef = doc(db, "inventory", item.id);
        const itemSnap = await getDoc(itemRef);

        if (itemSnap.exists()) {
          const currentStock = itemSnap.data().totalStockOnHand;
          if (item.quantity > currentStock) {
            stockErrors.push(`${item.name} (Available: ${currentStock})`);
          }
        } else {
          stockErrors.push(`${item.name} (Not found in inventory)`);
        }
      }

      return stockErrors;
    } catch (error) {
      console.error("Stock check error:", error);
      return ["Inventory check failed"];
    }
  };

  // discount function for existing customers
  const updateTotals = (items = kotItems) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    setSubTotal(parseFloat(subtotal));

    let newDiscount = 0;
    let credits = 0;

    if (isEmployee) {
      // Calculate maximum credits usable for employees
      credits = Math.min(employeeMealCredits, subtotal);
      newDiscount = credits;
    } else if (customerId) {
      // Existing customer discount logic
      // STRICTLY limit to maximum 20 points
      const maxAllowedDiscount = Math.min(20, subtotal);
      newDiscount = Math.min(customerPoints, maxAllowedDiscount);
    }

    setDiscount(newDiscount);
    const calculatedTotal = subtotal - newDiscount;
    setTotal(parseFloat(calculatedTotal));
    // ✅ Earned points calculated from fresh total
    let earned = 0;
    if (customerId && !isEmployee) {
      earned = Math.floor(calculatedTotal * 0.1);
    }
    setEarnedPoints(earned);
    // Update creditsUsed and cashDue for employees
    if (isEmployee) {
      setCreditsUsed(credits);
      console.log("updated cashdue");
      setCashDue(calculatedTotal);
    }
  };
  // discount function for new customers
  const applyNewCustomerDiscount = () => {
    const subtotal = kotItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const discount = Math.min(20, subtotal);
    setDiscount(parseFloat(discount));

    const calculatedTotal = subtotal - discount;
    setTotal(parseFloat(calculatedTotal));

    // ✅ Earned points calculated from fresh total
    const earnedPoints = Math.floor(calculatedTotal * 0.1);
    setEarnedPoints(earnedPoints);
  };
  const openNumberPad = (index) => {
    setSelectedItemIndex(index);
    setQuantityInput("");
    setShowNumberPad(true);
  };

  const handleNumberPadInput = (num) => {
    setQuantityInput((prev) => prev + num);
  };

  const clearInput = () => setQuantityInput("");

  const applyQuantity = () => {
    const qty = parseInt(quantityInput || "1", 10);
    if (isNaN(qty) || qty <= 0) return;
    const updated = [...kotItems];
    updated[selectedItemIndex].quantity = qty;
    setKotItems(updated);
    setShowNumberPad(false);
    updateTotals(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = kotItems.filter((_, i) => i !== index);
    setKotItems(updated);
    updateTotals(updated);
  };

  // Update the clearItems function to reset employee-related states
  const clearItems = () => {
    setKotItems([]);
    updateTotals([]);
    setKotId("");
    setIsPaymentProcessed(false);
    setPaymentMethod("");

    // Reset all customer-related states
    setCustomerId("");
    setCustomerPhone("");
    setCustomerName("");
    setCustomerPoints(0);
    setCustomerSearch("");
    setFoundCustomers([]);

    // Reset employee-specific states
    setEmployeeMealCredits(0);
    setCreditsUsed(0);
    setCashDue(0);
    setIsEmployee(false);
    setOrderType("dine-in");
    // Reset discount
    setDiscount(0);
  };

  // Modify handlePayClick
  const handlePayClick =async () => {
    if (kotItems.length === 0) {
      alert("Please add items before payment");
      return;
    }

    if (!orderType) {
      alert("Please select order type (Dine In/Takeaway)");
      return;
    }

    const stockErrors = await checkStockAvailability(kotItems);
    if (stockErrors.length > 0) {
      alert(`Cannot process payment:\n${stockErrors.join("\n")}`);
      return;
    }

    if (isEmployee) {
      if (location.state?.selectedEmployee?.isClockedIn) {
        alert("Employee must not be clocked in to use meal credits!");
        return;
      }

      // ✅ Use existing cashDue and creditsUpdated from state
      if (cashDue > 0) {
        setIsPaymentModalOpen(true);
        setPaymentMethod("Meal Credit + Cash");
      } else {
        setPaymentMethod("Meal Credit");
        setIsPaymentProcessed(true);
      }
    } else {
      setIsCustomerModalOpen(true);
    }
  };

  const generateKOTId = async (dateObj) => {
    const dbDate = new Date(dateObj);
    dbDate.setHours(0, 0, 0, 0); // Start of today
    const startTimestamp = Timestamp.fromDate(dbDate);

    const endDate = new Date(dbDate);
    endDate.setDate(endDate.getDate() + 1); // Start of tomorrow
    const endTimestamp = Timestamp.fromDate(endDate);

    // Query only today's KOTs using the `date` field
    const kotQuery = query(
      collection(db, "KOT"),
      where("date", ">=", startTimestamp),
      where("date", "<", endTimestamp)
    );

    const snapshot = await getDocs(kotQuery);
    const number = snapshot.size + 1;

    // Generate prefix: DDMMYY
    const prefix = `${String(dateObj.getDate()).padStart(2, "0")}${String(
      dateObj.getMonth() + 1
    ).padStart(2, "0")}${String(dateObj.getFullYear()).slice(-2)}`;

    return `${prefix}${String(number).padStart(3, "0")}`; // e.g. 050525001
  };

  const handleStoreOrder = async () => {
    if (kotItems.length === 0) {
      alert("Please add items before storing order");
      return;
    }

    try {
      const orderId = uuidv4();
      const orderData = {
        orderId,
        items: kotItems,
        orderType,
        subTotal,
        discount,
        total,
        customerId: isEmployee ? null : customerId,
        employeeId: isEmployee ? customerId : null,
        customerName,
        customerPhone,
        isEmployee,
        employeeMealCredits,
        creditsUsed,
        cashDue,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        ),
        status: "pending",
      };

      await setDoc(doc(db, "pendingOrders", orderId), orderData);
      setOrderId(orderId);
      setIsOrderStored(true);

      // ✅ Clear KOT and related states after storing
      setKotItems([]);
      setCustomerId("");
      setCustomerName("");
      setCustomerPhone("");
      setIsEmployee(false);
      setCreditsUsed(0);
      setCashDue(0);
      // Optionally reset subTotal, discount, total, etc.
      setSubTotal(0);
      setDiscount(0);
      setTotal(0);

      alert(`Order stored successfully! ID: ${orderId}`);
    } catch (error) {
      console.error("Error storing order:", error);
      alert("Failed to store order");
    }
  };

  const performSearch = async (searchTerm) => {
    if (!searchTerm) return [];

    try {
      const customersRef = collection(db, "customers");
      const empRef = collection(db, "users_01");

      const [customerPhoneSnap, customerIdSnap, empPhoneSnap, empIdSnap] =
        await Promise.all([
          getDocs(query(customersRef, where("phone", "==", searchTerm))),
          getDocs(query(customersRef, where("customerID", "==", searchTerm))),
          getDocs(query(empRef, where("phone", "==", searchTerm))),
          getDocs(query(empRef, where("employeeID", "==", searchTerm))),
        ]);

      const results = [];

      // Process results
      empPhoneSnap.forEach((doc) =>
        results.push({
          ...doc.data(),
          phone: doc.id, // Document ID is phone number
          isEmployee: true,
        })
      );
      empIdSnap.forEach((doc) =>
        results.push({
          ...doc.data(),
          phone: doc.id, // Document ID remains phone number
          isEmployee: true,
        })
      );
      empPhoneSnap.forEach((doc) =>
        results.push({ ...doc.data(), isEmployee: true, EmployeeID: doc.id })
      );
      empIdSnap.forEach((doc) =>
        results.push({ ...doc.data(), isEmployee: true, EmployeeID: doc.id })
      );

      // Deduplicate and check clock-in status
      const uniqueResults = Array.from(
        new Set(results.map((r) => r.phone || r.EmployeeID))
      ).map((id) => results.find((r) => (r.phone || r.EmployeeID) === id));

      const finalResults = await Promise.all(
        uniqueResults.map(async (result) => {
          if (result.isEmployee) {
            const isClockedIn = await checkEmployeeClockInStatus(
              result.EmployeeID
            );
            return { ...result, isClockedIn };
          }
          return result;
        })
      );

      return finalResults;
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  };

  const generateCustomerId = async () => {
    const customersQuery = query(
      collection(db, "customers"),
      orderBy("customerID", "desc"),
      limit(1)
    );
    const snapshot = await getDocs(customersQuery);
    let number = 1;
    if (!snapshot.empty) {
      const lastId = snapshot.docs[0].data().customerID;
      const lastNum = parseInt(lastId.replace("cus", "")) || 0;
      number = lastNum + 1;
    }
    return `cus${String(number).padStart(2, "0")}`;
  };

  const checkEmployeeClockInStatus = async (employeePhone) => {
    try {
      const today = new Date();
      const monthDocId = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}`;
      const dayKey = String(today.getDate()).padStart(2, "0");
      const attendanceRef = doc(
        db,
        "users_01",
        employeePhone,
        "attendance",
        monthDocId
      );
      const attendanceSnap = await getDoc(attendanceRef);

      return (
        attendanceSnap.exists() &&
        attendanceSnap.data().days?.[dayKey]?.isClockedIn === true
      );
    } catch (error) {
      console.error("Error checking clock-in status:", error);
      return false;
    }
  };

  const searchCustomer = async () => {
    try {
      const customersRef = collection(db, "customers");
      const empRef = collection(db, "users_01");

      const [customerPhoneSnap, customerIdSnap, empPhoneSnap, empIdSnap] =
        await Promise.all([
          getDocs(query(customersRef, where("phone", "==", customerSearch))),
          getDocs(
            query(customersRef, where("customerID", "==", customerSearch))
          ),
          getDocs(query(empRef, where("phone", "==", customerSearch))),
          getDocs(query(empRef, where("employeeID", "==", customerSearch))),
        ]);

      const manualResults = [];

      // Collect customer results
      customerPhoneSnap.forEach((doc) =>
        manualResults.push({ ...doc.data(), isEmployee: false })
      );
      customerIdSnap.forEach((doc) =>
        manualResults.push({ ...doc.data(), isEmployee: false })
      );

      // Collect employee results
      empPhoneSnap.forEach((doc) => {
        const data = doc.data();
        manualResults.push({
          ...data,
          isEmployee: true,
          EmployeeID: data.employeeID, // Use the EmployeeID from document data
          phone: doc.id, // Document ID is the phone number
        });
      });

      empIdSnap.forEach((doc) => {
        const data = doc.data();
        manualResults.push({
          ...data,
          isEmployee: true,
          EmployeeID: data.employeeID,
          phone: data.phone, // Phone from document data
        });
      });

      if (manualResults.length === 0) {
        alert("No customer or employee found with this ID/phone number.");
        return;
      }

      // Remove duplicates
      const uniqueResults = Array.from(
        new Set(manualResults.map((r) => r.phone || r.EmployeeID))
      ).map((id) =>
        manualResults.find((r) => (r.phone || r.EmployeeID) === id)
      );

      // Check clock-in status
      const finalResults = await Promise.all(
        uniqueResults.map(async (result) => {
          if (result.isEmployee) {
            const isClockedIn = await checkEmployeeClockInStatus(
              result.EmployeeID
            );
            return { ...result, isClockedIn };
          }
          return result;
        })
      );

      setFoundCustomers(finalResults); // ✅ This should be the final state update
    } catch (error) {
      console.error(error);
      alert("Error searching customers");
    }
  };

  const handleSelectCustomer = async (customer) => {
    if (customer.isEmployee) {
      setIsEmployee(true);
      setCustomerId(customer.EmployeeID);
      const isClockedIn = await checkEmployeeClockInStatus(customer.employeeID);
      if (isClockedIn) {
        alert("Clocked-in employees cannot use loyalty program!");
        return;
      }

      // Fetch employee's meal credits
      try {
        const mealRef = doc(db, "users_01", customer.phone, "meal", "1");
        const mealSnap = await getDoc(mealRef);
        const mealData = mealSnap.exists()
          ? mealSnap.data()
          : { mealCredits: 0 };

        setEmployeeMealCredits(mealData.mealCredits || 0);
        setIsEmployee(true);
      } catch (error) {
        console.error("Error fetching meal credits:", error);
        alert("Error loading employee meal credits");
        return;
      }
    } else {
      setIsEmployee(false);
    }

    // Rest of the existing code...
    setCustomerId(customer.customerID || customer.employeeID);
    setCustomerPhone(customer.phone);
    setCustomerName(customer.name);
    setCustomerPoints(customer.points || 0);
    setIsCustomerModalOpen(false);
    setIsOrderTypeModalOpen(true);

    if (customer.points > 0) {
      const maxAllowedDiscount = Math.min(20, subTotal);
      const actualDiscount = Math.min(customer.points, maxAllowedDiscount);
      setDiscount(actualDiscount);
      setTotal(subTotal - actualDiscount);
    } else {
      setDiscount(0);
      setTotal(subTotal);
    }

    setIsCustomerModalOpen(false);
    setIsOrderTypeModalOpen(true);
  };

  const generateNineDigitUserId = async () => {
    const customersRef = collection(db, "customers");
    let userId;
    let exists = true;

    while (exists) {
      userId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const querySnapshot = await getDocs(
        query(customersRef, where("userId", "==", userId))
      );
      exists = !querySnapshot.empty;
    }
    return userId;
  };

  const createNewCustomer = async () => {
    if (!customerPhone || !customerName) {
      alert("Please enter phone number and name");
      return;
    }

    try {
      const newCustomerId = await generateCustomerId();
      const newUserId = String(
        Math.floor(100000000 + Math.random() * 900000000)
      ); // Generate a 9-digit userId

      const customerData = {
        customerID: newCustomerId,
        userId: newUserId, // Add the userId
        name: customerName,
        phone: customerPhone,
        points: 20,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "customers", customerPhone), customerData);

      setCustomerId(newCustomerId);
      setCustomerPhone(customerPhone);
      setCustomerName(customerName);
      setCustomerPoints(20);
      setIsCustomerModalOpen(false);
      setIsPaymentModalOpen(true);
      setIsNewCustomer(false);
      applyNewCustomerDiscount();
	  setIsOrderTypeModalOpen(true);
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("Error creating customer");
    }
  };

  const handleGenerateKOT = async () => {
    let pointsToDeduct = 0;
    let updatedPoints = 0;
    if (!isPaymentProcessed) {
      alert("Please process payment before saving KOT.");
      return;
    }

    try {
      const stockErrors = await checkStockAvailability(kotItems);

      if (stockErrors.length > 0) {
        alert(`Insufficient stock:\n${stockErrors.join("\n")}`);
        setIsPaymentProcessed(false);
        return;
      }
      // ✅ Ensure consistent timestamp
      const now = new Date();
      const kotTimestamp = Timestamp.fromDate(now);

      // ✅ First update inventory
      await updateInventory(kotItems);

      // ✅ Generate KOT ID using same date
      const newKOTId = await generateKOTId(now);
      setKotId(newKOTId);

      // ✅ Use existing earnedPoints from state
      console.log("Earned Points for this order:", earnedPoints);

      // ✅ Prepare KOT data
      const data = {
        kot_id: newKOTId,
        date: kotTimestamp,
        amount: total.toFixed(3),
        customerID: customerId || null,
        creditsUsed: isEmployee ? creditsUsed : 0,
        cashPaid: isEmployee ? cashDue : total,
        earnedPoints: earnedPoints,
        items: kotItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        orderType: orderType,
        methodOfPayment: paymentMethod,
      };

      // ✅ Save KOT to Firestore
      await setDoc(doc(db, "KOT", newKOTId), data);

      if (orderId) {
        await updateDoc(doc(db, "pendingOrders", orderId), {
          status: "completed",
        });
        console.log("updated pending status");
      }

      if (isEmployee && creditsUsed > 0) {
        const mealRef = doc(db, "users_01", customerPhone, "meal", "1");

        await runTransaction(db, async (transaction) => {
          const mealDoc = await transaction.get(mealRef);
          if (!mealDoc.exists()) throw new Error("Meal document not found");

          const currentCredits = mealDoc.data().mealCredits;
          if (currentCredits < creditsUsed) {
            throw new Error("Insufficient meal credits");
          }

          transaction.update(mealRef, {
            mealCredits: increment(-creditsUsed),
            lastUpdated: Timestamp.now(),
          });
        });
      }

      // ✅ Deduct loyalty points if applicable (Deduct)
      if (customerId && !isEmployee && discount > 0) {
        const customerRef = doc(db, "customers", customerPhone);

        await runTransaction(db, async (transaction) => {
          const customerDocSnap = await transaction.get(customerRef);

          if (!customerDocSnap.exists()) {
            throw new Error("Customer document not found");
          }

          const currentPoints = Number(customerDocSnap.data().points) || 0;
          // Calculate the ACTUAL points to deduct (never more than 20)
          pointsToDeduct = Math.min(discount, 20, currentPoints);
          if (currentPoints < pointsToDeduct) {
            throw new Error("Customer doesn't have enough points");
          }
          const afterDeduction = currentPoints - pointsToDeduct;

          // 2️⃣ Add earned points
          updatedPoints = afterDeduction + earnedPoints;
          transaction.update(customerRef, {
            points: updatedPoints,
            updatedAt: kotTimestamp,
          });
        });

        await addDoc(collection(db, "loyaltyHistory"), {
          customerID: customerId,
          type: "redeem",
          points: pointsToDeduct,
          orderID: newKOTId,
          date: kotTimestamp,
        });
      }

      // ✅ Print KOT
      const printContent = `
  <div style="
    width: 280px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: #000;
    padding: 5px;
  ">
    <div style="text-align: center; margin-bottom: 5px;">
      <img src="./logo192.png" alt="Logo" style="width: 50px;" />
    </div>

    <h3 style="text-align: center; margin: 0; padding: 5px 0;">KOT</h3>

    <p><strong>KOT ID:</strong> ${newKOTId}</p>
    <p><strong>Order Type:</strong> ${
      orderType === "dine-in" ? "Dine In" : "Takeaway"
    }</p>
    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>

    ${
      customerId
        ? `<p><strong>${
            isEmployee ? "Employee" : "Customer"
          }:</strong> ${customerName} (${customerId})</p>`
        : ""
    }

    ${
      isEmployee
        ? `<p><strong>Meal Credits Used:</strong> £${creditsUsed.toFixed(2)}</p>
       ${
         cashDue > 0
           ? `<p><strong>Cash Due:</strong> £${cashDue.toFixed(2)}</p>`
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
        ${kotItems
          .map(
            (item) => `
            <tr>
              <td style="padding: 2px 0;">
                ${item.name}
                ${
                  item.sauces?.length > 0
                    ? `<div style="font-size: 10px; color: #555;">(${item.sauces.join(
                        ", "
                      )})</div>`
                    : ""
                }
              </td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">£${(
                item.quantity * item.price
              ).toFixed(2)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

    <p><strong>Sub Total:</strong> £${subTotal.toFixed(2)}</p>
    <p><strong>Discount:</strong> £${
      isEmployee ? creditsUsed.toFixed(2) : subTotal - total
    }</p>
    <p><strong>Total:</strong> £${total.toFixed(2)}</p>

    ${
      customerPoints >= 2 && !isEmployee
        ? `<p style="color: green;"> Discount applied: ${pointsToDeduct} (Remaining Points: ${updatedPoints})</p>`
        : ""
    }

    ${
      customerId && !isEmployee
        ? `<p><strong>Earned Points:</strong> ${earnedPoints}</p>`
        : ""
    }

    <hr style="border: none; border-top: 1px dashed #000; margin: 6px 0;" />

    <p style="text-align: center;">--- Thank You ---</p>
  </div>
`;

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

      clearItems();
    } catch (error) {
      console.error("Error in KOT generation:", error);
      alert("Failed to complete order. Please try again.");
    }
  };

  const handleProcessPayment = () => {
    if (!paymentMethod) {
      setIsPaymentProcessed(true);
      setIsPaymentModalOpen(false);
    } else {
      alert("Please select a payment method.");
    }
  };
  return (
    <div className="p-4 w-full max-w-sm mx-auto">
      <h2 className="text-2xl font-bold mb-4">ORDER</h2>

      {kotId && (
        <div className="mb-4 text-base font-semibold text-indigo-700 border border-indigo-300 rounded p-2 bg-indigo-50">
          KOT ID: <span className="font-mono">{kotId}</span>
        </div>
      )}

      {customerId && (
        <div className="mb-4 text-base font-semibold text-green-700 border border-green-300 rounded p-2 bg-green-50">
          {isEmployee ? (
            <>
              Employee: {customerName} (ID: {customerId})
              <p>Meal Credits: £{employeeMealCredits}</p>
              {creditsUsed > 0 && <p>Credits Used: £{creditsUsed}</p>}
              {cashDue > 0 && <p>Cash Due: £{cashDue}</p>}
            </>
          ) : (
            <>
              Customer: {customerName} (ID: {customerId}) - Points:{" "}
              {customerPoints}
              {discount > 0 && (
                <p className="text-green-600">
                  £{discount} discount applied using points
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="border p-3 rounded mb-3 bg-white flex flex-col max-h-[300px]">
        <div className="overflow-y-auto flex-1 mb-3">
          <table className="w-full text-left mb-3">
            <thead>
              <tr>
                <th>ITEM</th>
                <th>QUANTITY</th>
                <th>PRICE</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {kotItems.map((item, index) => (
                <tr key={index}>
                  <td>
                    {item.name}
                    {item.sauces?.length > 0 && (
                      <div className="text-sm text-gray-500">
                        {item.sauces.join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const updated = [...kotItems];
                          updated[index].quantity = Math.max(
                            updated[index].quantity - 1,
                            1
                          );
                          setKotItems(updated);
                          updateTotals(updated);
                        }}
                        className="bg-gray-300 text-xl w-6 h-6 rounded-full flex items-center justify-center"
                      >
                        -
                      </button>
                      <button
                        onClick={() => openNumberPad(index)}
                        className="bg-gray-100 text-xl w-6 h-6 rounded-full flex items-center justify-center"
                      >
                        {item.quantity}
                      </button>
                      <button
                        onClick={() => {
                          const updated = [...kotItems];
                          updated[index].quantity += 1;
                          setKotItems(updated);
                          updateTotals(updated);
                        }}
                        className="bg-gray-300 text-xl w-6 h-6 rounded-full flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>£{(item.quantity * item.price).toFixed(2)}</td>
                  <td>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="text-red-600"
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p>Sub Total: £{subTotal.toFixed(2)}</p>
          <p>Discount: £{discount.toFixed(2)}</p>
          <p className="font-bold text-lg">Total: £{total.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mt-auto">
        {/* PAY Button */}
        <button
          onClick={handlePayClick}
          className="bg-blue-600 text-white p-2 rounded"
        >
          PAY
        </button>

        {/* STORE Button */}
        <button
          className="bg-blue-600 text-white p-2 rounded"
          onClick={handleStoreOrder}
          disabled={kotItems.length === 0}
        >
          STORE
        </button>

        {/* CANCEL Button - spans 2 columns */}
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="bg-red-600 text-white p-2 rounded col-span-2"
        >
          CANCEL
        </button>
      </div>

      {/* Number Pad Modal */}
      {showNumberPad && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[300px] relative">
            <button
              onClick={() => setShowNumberPad(false)}
              className="absolute top-2 right-2 text-red-600 font-bold text-xl"
            >
              ✕
            </button>

            <div className="text-xl font-semibold mb-2 text-center">
              Enter Quantity
            </div>

            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() =>
                  setQuantityInput((prev) =>
                    String(Math.max(parseInt(prev || "0", 10) - 1, 1))
                  )
                }
                className="bg-gray-300 text-xl w-10 h-10 rounded-full"
              >
                -
              </button>
              <div className="text-3xl text-center border p-2 px-6 bg-gray-100 rounded">
                {quantityInput || "0"}
              </div>
              <button
                onClick={() =>
                  setQuantityInput((prev) =>
                    String(parseInt(prev || "0", 10) + 1)
                  )
                }
                className="bg-gray-300 text-xl w-10 h-10 rounded-full"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberPadInput(String(num))}
                  className="bg-gray-200 text-2xl p-4 rounded"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={clearInput}
                className="bg-yellow-400 col-span-1 p-2 rounded"
              >
                Clear
              </button>
              <button
                onClick={applyQuantity}
                className="bg-green-600 text-white col-span-2 p-2 rounded"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      {/*cancel order confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg text-center space-y-4">
            <p className="text-lg font-semibold">
              Do you really want to cancel the order?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  clearItems();
                  setShowCancelConfirm(false);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Yes
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="bg-gray-300 text-black px-4 py-2 rounded"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[400px] text-center relative">
            <button
              onClick={() => {
                setIsCustomerModalOpen(false);
                setIsNewCustomerMode(false); // Reset when closing modal
              }}
              className="absolute top-2 right-2 text-red-600 font-bold text-xl"
            >
              ✕
            </button>

            {isNewCustomerMode ? (
              // New Customer Creation Form
              <>
                <h3 className="text-xl font-bold mb-4">Add New Customer</h3>
                <input
                  className="border p-2 mb-2 w-full"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <input
                  className="border p-2 mb-4 w-full"
                  placeholder="Phone Number"
                  value={customerPhone}
                  maxLength={10}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsNewCustomerMode(false)} // Go back to search mode
                    className="mr-2 px-4 py-2 bg-gray-300 rounded"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      createNewCustomer();
                      setIsOrderTypeModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              // Customer Loyalty Program (Search form)
              <>
                <h3 className="text-xl font-bold mb-4">
                  Customer Loyalty Program
                </h3>

                <div className="mb-4">
                  <p className="mb-2">
                    Enter Customer ID or Phone Number (Optional):
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Customer ID or Phone"
                      className="border p-2 flex-1 rounded"
                    />
                    <button
                      onClick={searchCustomer}
                      className="bg-blue-600 text-white px-4 py-2 rounded"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {foundCustomers.map((customer) => {
                  const isEmployee = customer.isEmployee;
                  const identifier = isEmployee
                    ? customer.EmployeeID
                    : customer.customerID;
                  const type = isEmployee ? "Employee" : "Customer";

                  return (
                    <div
                      key={identifier}
                      className="p-2 border-b hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="font-medium">
                        {customer.name} ({type})
                      </div>
                      {isEmployee && customer.isClockedIn && (
                        <div className="text-red-600 text-sm">
                          ⛔ Currently clocked in
                        </div>
                      )}
                      {customer.points >= 2 &&
                        !(isEmployee && customer.isClockedIn) && (
                          <div className="text-green-600 text-sm">
                            Available Points: {customer.points}
                          </div>
                        )}
                    </div>
                  );
                })}

                <div className="flex gap-2 justify-center mt-4">
                  <button
                    onClick={() => {
                      setIsCustomerModalOpen(false);
                      setIsOrderTypeModalOpen(true);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded"
                  >
                    Skip Loyalty
                  </button>
                  <button
                    onClick={() => setIsNewCustomerMode(true)} // Switch to new customer form
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    New Customer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isOrderTypeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[300px] text-center relative">
            {/* Close button (X) in top-right corner */}
            <button
              onClick={() => setIsOrderTypeModalOpen(false)}
              className="absolute top-2 right-2 text-red-600 font-bold text-xl"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">Select Order Type</h2>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  console.log("User selected: Dine-In");
                  setIsOrderTypeModalOpen(false);
                  setIsCustomerModalOpen(false);
                  setIsPaymentModalOpen(true);
                  setOrderType("dine-in");
                }}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Dine-In
              </button>
              <button
                onClick={() => {
                  console.log("User selected: Takeaway");
                  setIsOrderTypeModalOpen(false);
                  setIsCustomerModalOpen(false);
                  setIsPaymentModalOpen(true);
                  setOrderType("takeaway");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Takeaway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[300px] text-center relative">
            <button
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute top-2 right-2 text-red-600 font-bold text-xl"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold mb-4">Select Payment Method</h3>
            <div className="flex justify-center gap-4 mb-4">
              <button
                className={`px-4 py-2 rounded ${
                  paymentMethod === "card"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200"
                }`}
                onClick={() => {
                  setPaymentMethod("card");
                  setShowPaymentScreen(true);
                  setIsPaymentModalOpen(false);
                }}
              >
                Proceed to Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentScreen && (
        <PaymentScreen
          amount={total}
          isEmployee={isEmployee}
          customerPhone={customerPhone}
          onComplete={(success) => {
            setShowPaymentScreen(false);
            if (success) {
              setIsPaymentProcessed(true);
            }
          }}
          onClose={() => setShowPaymentScreen(false)}
        />
      )}
    </div>
  );
}

// Function to add userId to existing customers
const addUserIdToExistingCustomers = async () => {
  try {
    const customersRef = collection(db, "customers");
    const snapshot = await getDocs(customersRef);

    snapshot.forEach(async (docSnap) => {
      const customerData = docSnap.data();

      // Check if the userId field is missing
      if (!customerData.userId) {
        const newUserId = String(
          Math.floor(100000000 + Math.random() * 900000000)
        ); // Generate a 9-digit userId

        // Update the document with the new userId
        await updateDoc(doc(db, "customers", docSnap.id), {
          userId: newUserId,
          updatedAt: new Date(), // Optional: Update the timestamp
        });

        console.log(`Updated customer ${docSnap.id} with userId: ${newUserId}`);
      }
    });

    console.log("All customers updated successfully!");
  } catch (error) {
    console.error("Error updating customers:", error);
  }
};

// Call the function
addUserIdToExistingCustomers();
