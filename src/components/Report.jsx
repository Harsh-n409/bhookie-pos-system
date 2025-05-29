import React, { useState, useEffect, useMemo } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  startAfter,
} from "firebase/firestore";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { CSVLink } from "react-csv";
import { useReactToPrint } from "react-to-print";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { useAuth } from "../contexts/AutoContext";
const roleMap = {
  cash01: "cashier",
  manage01: "manager",
  cashier: "cashier",
  manager: "manager",
  teamleader:"teamleader",
  admin:"admin"
};

const CURRENCY_SYMBOL = "£";
const PAGE_SIZE = 50;
const DATE_FORMAT = "yyyy-MM-dd";

const itemCategoryMap = {
  "Chicken Fries": "cat02",
  "Chicken fillets": "cat01",
  "Manchurian Bites": "cat01",
  "Classic Fries": "cat02",
  "Signature Fries": "cat02",
  "Potato Twirl": "cat02",
  "Vada Pav": "cat03",
  "Samosa Pav": "cat03",
  "Bhaji Pav": "cat03",
  "Chicken Wrap": "cat04",
  "Paneer Wrap": "cat04",
  "Manchurian Wrap": "cat04",
  "Veggie Aloo Tikki Burger": "cat05",
  "Chicken Classic Burger": "cat05",
  "Chicken Spicy Burger": "cat05",
  "Paneer Burger": "cat05",
  "Noodle Bhel": "cat06",
  "Kulhad Pizza": "cat06",
  "Chai": "cat07",
  "Filter Coffee": "cat07",
  "Chicken Drumsticks": "cat01",
  "Chicken Bites": "cat01",
  // Add more item name to category mappings here
};

const ReportPage = () => {
  // Authentication states
  const { setUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Report states
  const [attendanceData, setAttendanceData] = useState([]);
  const [kotHistory, setKotHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [empNameFilter, setEmpNameFilter] = useState("");
  const [currentView, setCurrentView] = useState("home");
  const db = getFirestore();
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedKOT, setSelectedKOT] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [salesStartDate, setSalesStartDate] = useState(startOfDay(new Date()));
  const [salesEndDate, setSalesEndDate] = useState(endOfDay(new Date()));
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const reportRef = React.useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategoriesAndItems = async () => {
      const cats = await getDocs(collection(db, "category"));
      setCategories(cats.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const items = await getDocs(collection(db, "items"));
      setItemsList(items.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      const users = await getDocs(collection(db, "users_01")); // Changed to users_01 based on manager login
      setUsersList(users.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    if (isAuthenticated) fetchCategoriesAndItems();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (currentView === "attendance") {
        fetchAttendanceData();
      } else if (["kot", "sales"].includes(currentView)) {
        fetchKOTHistory();
      }
    }
  }, [
    selectedDate,
    currentView,
    paymentFilter,
    customerFilter,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (isAuthenticated && currentView === "sales") {
      fetchSalesData();
    }
  }, [
    salesStartDate,
    salesEndDate,
    paymentFilter,
    isAuthenticated,
    currentView,
  ]);

  useEffect(() => {
    if (selectedPeriod === "custom") return;

    const now = new Date();
    let start, end;

    switch (selectedPeriod) {
      case "daily":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "weekly":
        start = startOfWeek(now);
        end = endOfWeek(now);
        break;
      case "monthly":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "yearly":
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        return;
    }
    console.log("Setting Dates", { start, end });
    setSalesStartDate(start);
    setSalesEndDate(end);
  }, [selectedPeriod]);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      let baseQuery = query(
        collection(db, "KOT"),
        where("date", ">=", salesStartDate),
        where("date", "<=", salesEndDate),
        orderBy("date", "desc")
      );

      if (paymentFilter !== "all") {
        baseQuery = query(
          baseQuery,
          where("methodOfPayment", "==", paymentFilter)
        );
      }

      const querySnapshot = await getDocs(baseQuery);
      const newHistory = querySnapshot.docs
  .map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: data.date.toDate(),
      amount: parseFloat(data.amount) || 0,
      items: (data.items || []).map((item) => ({
        ...item,
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity) || 0,
      })),
      methodOfPayment: data.methodOfPayment || "Unknown", // Handle missing field
    };
  })
  .filter((kot) => {
    if (paymentFilter === "all") return true;
    return kot.methodOfPayment === paymentFilter;
  });


      setKotHistory(newHistory);
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    return kotHistory.filter((kot) => {
      // Date filter
      const isWithinDateRange = isWithinInterval(kot.date, {
        start: salesStartDate,
        end: salesEndDate,
      });

      // Payment method filter
      const matchesPayment =
        paymentFilter === "all" || kot.methodOfPayment === paymentFilter;

      // Order type filter
      const matchesOrderType =
        orderTypeFilter === "all" || kot.orderType === orderTypeFilter;

      // Customer filter (assuming customerId in KOT)
      const matchesCustomer =
        !customerFilter.trim() ||
        (kot.customerId && // Changed from customerID to customerId for consistency with fetchKOTHistory
          kot.customerId
            .toString()
            .toLowerCase()
            .includes(customerFilter.trim().toLowerCase()));

      // Item filters
      const hasMatchingItems = kot.items.some((item) => {
        // Get category from itemCategoryMap using item name
        const itemCategory = itemCategoryMap[item.name] || "Uncategorized";

        // Category filter check
        const matchesCategory =
          categoryFilter === "all" || itemCategory === categoryFilter;

        // Item name filter check
        const matchesName =
          !itemNameFilter ||
          item.name.toLowerCase().includes(itemNameFilter.toLowerCase());

        return matchesCategory && matchesName;
      });

      return (
        isWithinDateRange &&
        matchesPayment &&
        matchesOrderType &&
        matchesCustomer &&
        hasMatchingItems
      );
    });
  }, [
    kotHistory,
    salesStartDate,
    salesEndDate,
    paymentFilter,
    orderTypeFilter,
    customerFilter,
    categoryFilter,
    itemNameFilter,
    itemCategoryMap,
    selectedPeriod,
  ]);

  const getUserName = (userId) => {
    const user = usersList.find(user => user.employeeID === userId);
    return user ? user.name : userId; // Return name if found, else return ID
  };

  const summaryData = useMemo(() => {
    let totalSales = 0;
    let totalItemsSold = 0;
    const itemsCount = {};

    // Use filteredSales instead of kotHistory to respect current filters
    filteredSales.forEach((kot) => {
      totalSales += kot.amount;
      kot.items.forEach((item) => {
        totalItemsSold += item.quantity;
        itemsCount[item.name] = (itemsCount[item.name] || 0) + item.quantity;
      });
    });

    // Calculate number of days in selected period
    // In summaryData calculation
    const daysInPeriod =
      Math.abs(differenceInDays(salesEndDate, salesStartDate)) + 1;

    // Calculate averages
    const averageDailySales = totalSales / daysInPeriod;
    const averagePerOrder =
      filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

    const itemsArray = Object.entries(itemsCount).map(([name, count]) => ({
      name,
      count,
    }));
    const bestseller = itemsArray.reduce(
      (max, item) => (item.count > max.count ? item : max),
      { count: 0 }
    );
    const leastSold = itemsArray.reduce(
      (min, item) => (item.count < min.count ? item : min),
      { count: Infinity }
    );

    return {
      totalSales,
      totalOrders: filteredSales.length,
      totalItemsSold,
      bestseller,
      leastSold,
      averageDailySales, // Add new metrics
      averagePerOrder,
    };
  }, [filteredSales, salesStartDate, salesEndDate]);

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const currentDate = format(new Date(), "yyyy-MM-dd_HH-mm-ss");

      // Add report title
      doc.setFontSize(18);
      doc.text("Sales Report", 14, 22);
      doc.setFontSize(12);
      doc.text(`Generated: ${format(new Date(), "PPPP")}`, 14, 28);

      // Prepare table data
      const columns = [
        "Item Name",
        "Category",
        "Quantity",
        "Unit Price",
        "Total",
        "Order Type",
        "Payment Method",
        "Cashier",
        "Time",
      ];

      const rows = filteredSales.flatMap((kot) =>
        kot.items.map((item) => [
          item.name || "N/A",
          itemCategoryMap[item.name] || "Uncategorized", // Changed to use itemCategoryMap
          item.quantity,
          `${CURRENCY_SYMBOL}${item.price?.toFixed(2) || "0.00"}`,
          `${CURRENCY_SYMBOL}${
            (item.quantity * item.price)?.toFixed(2) || "0.00"
          }`,
          kot.orderType || "N/A",
          kot.methodOfPayment || "N/A",
          getUserName(kot.userId), // Changed to display user name
          format(kot.date, "HH:mm:ss"),
        ])
      );

      // Add autoTable
      doc.autoTable({
        head: [columns],
        body: rows,
        startY: 35,
        styles: {
          fontSize: 10,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 11,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          2: { cellWidth: 20 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
        },
      });

      // Add summary section
      const summaryY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("Summary", 14, summaryY);

      const summaryDataPDF = [ // Renamed to avoid conflict with outer summaryData
        [`Total Sales: ${CURRENCY_SYMBOL}${summaryData.totalSales.toFixed(2)}`],
        [`Total Orders: ${summaryData.totalOrders}`],
        [
          `Bestseller: ${summaryData.bestseller?.name} (${summaryData.bestseller?.count})`,
        ],
        [
          `Least Sold: ${summaryData.leastSold?.name} (${summaryData.leastSold?.count})`,
        ],
      ];

      doc.autoTable({
        body: summaryDataPDF,
        startY: summaryY + 5,
        showHead: false,
        styles: {
          fontSize: 11,
          cellPadding: 3,
        },
        theme: "plain",
      });

      // Save the PDF
      doc.save(`sales_report_${currentDate}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  function getTodayDate() {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }

  // Manager authentication handler
  const handleManagerLogin = async () => {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      alert("Please enter a valid employee ID.");
      return;
    }

    setAuthLoading(true);

    try {
      const usersRef = collection(db, "users_01");
      const q = query(usersRef, where("employeeID", "==", trimmedCode));
      const querySnapshot = await getDocs(q);

      console.log("Searching for employeeID:", trimmedCode);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        console.log("Found user document:", userData);

        // Case-insensitive role check
        const roleCode = userData.role?.toLowerCase().trim();
        const role =
          roleMap[
            Object.keys(roleMap).find((key) => key.toLowerCase() === roleCode)
          ];

        if (role === "manager" || role==="admin" || role === "teamleader") {
          setIsAuthenticated(true);
        } else {
          alert("Only managers can access this page.");
        }
      } else {
        alert(
          "No employee found with this ID. Please check the ID and try again."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please check your connection and try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      const logsRef = collection(db, "AttendanceLogs", selectedDate, "logs");
      const querySnapshot = await getDocs(logsRef);
      const logsData = querySnapshot.docs.map((doc) => doc.data());
      setAttendanceData(logsData);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Sales Report", 14, 20);

    // Add Date Range
    doc.setFontSize(12);
    doc.text(
      `From: ${format(salesStartDate, "dd-MM-yyyy")} To: ${format(
        salesEndDate,
        "dd-MM-yyyy"
      )}`,
      14,
      30
    );

    // Add Summary Section
    const summary = [
      ["Total Sales", `${CURRENCY_SYMBOL}${summaryData.totalSales.toFixed(2)}`],
      ["Total Orders", summaryData.totalOrders],
      ["Total Items Sold", summaryData.totalItemsSold],
      [
        "Bestseller",
        `${summaryData.bestseller.name} (${summaryData.bestseller.count})`,
      ],
      [
        "Least Sold",
        `${summaryData.leastSold.name} (${summaryData.leastSold.count})`,
      ],
      ["Average Daily Sales", `${CURRENCY_SYMBOL}${summaryData.averageDailySales.toFixed(2)}`], // Added currency symbol and fixed to 2 decimal places
      ["Average Per Order", `${CURRENCY_SYMBOL}${summaryData.averagePerOrder.toFixed(2)}`], // Added currency symbol and fixed to 2 decimal places
    ];

    autoTable(doc, {
      startY: 35,
      head: [["Metric", "Value"]],
      body: summary,
    });

    // Add Table of Items
    const itemRows = filteredSales.flatMap((kot) =>
      kot.items.map((item) => [
        item.name,
        itemCategoryMap[item.name] || "Uncategorized", // Changed to use itemCategoryMap
        item.quantity,
        item.price.toFixed(2),
        (item.price * item.quantity).toFixed(2),
        kot.orderType,
        kot.methodOfPayment,
        getUserName(kot.userId), // Changed to display user name
        format(kot.date, "HH:mm:ss"),
      ])
    );

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [
        [
          "Item",
          "Category",
          "Qty",
          "Unit Price",
          "Total",
          "Order Type",
          "Payment",
          "Cashier",
          "Time",
        ],
      ],
      body: itemRows,
    });

    doc.save(`Sales_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };
  const handleExitClick = () => {
    logout();
    navigate("/");
  };

  const fetchKOTHistory = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        setLastVisible(null);
        setHasMore(true);
      } else {
        if (!hasMore) return;
      }

      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      let baseQuery = query(
        collection(db, "KOT"),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc")
      );

      



      if (customerFilter) {
        // Assuming customerId in Firestore is stored directly as "cus01" or "Walk-in"
        // If it's stored as "customers/cus01", then the original line is correct.
        // For broad compatibility, we might remove the "customers/" prefix if the input is just the ID.
        // Let's assume customerId is stored directly as "cus01"
        baseQuery = query(
          baseQuery,
          where("customerId", "==", customerFilter)
        );
      }

      let paginatedQuery = query(baseQuery, limit(50));
      if (loadMore && lastVisible) {
        paginatedQuery = query(baseQuery, startAfter(lastVisible), limit(50));
      }

      const querySnapshot = await getDocs(paginatedQuery);
      const newHistory = querySnapshot.docs
       .map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      kot_id: data.kot_id,
      date: data.date.toDate(),
      amount: data.amount,
      customerId: data.customerId || null,
      earnedPoints: data.earnedPoints || 0,
      userId: data.userId || data.user_id || "unknown",
      items: data.items || [],
      methodOfPayment: data.methodOfPayment || "Unknown", // Normalize here
    };
  })
  .filter((kot) => {
    if (paymentFilter === "all") return true;
    return kot.methodOfPayment === paymentFilter;
  });

      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }

      setHasMore(querySnapshot.docs.length === 50);

      if (loadMore) {
        setKotHistory((prev) => [...prev, ...newHistory]);
      } else {
        setKotHistory(newHistory);
      }
    } catch (error) {
      console.error("Error fetching KOT history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (kotId) => {
    try {
      const kotRef = doc(db, "KOT", kotId);
      const kotSnap = await getDoc(kotRef);

      if (kotSnap.exists()) {
        const kotData = kotSnap.data();
        setSelectedKOT({
          id: kotSnap.id,
          ...kotData,
          date: kotData.date.toDate(),
          items: Array.isArray(kotData.items)
            ? kotData.items.map((item) => ({
                ...item,
                price: item.price || 0,
              }))
            : [],
            methodOfPayment:kotData.methodOfPayment,
        });
        setIsDetailModalOpen(true);
      }
    } catch (error) {
      console.error("Error fetching KOT details:", error);
    }
  };

  const formatSalesCSVData = () => {
    return filteredSales.flatMap((kot) => // Changed from kotHistory to filteredSales
      kot.items.map((item) => ({
        "KOT ID": kot.kot_id,
        Date: kot.date.toLocaleDateString(),
        Time: kot.date.toLocaleTimeString(),
        "Item Name": item.name,
        Category: itemCategoryMap[item.name] || "Uncategorized", // Added Category
        Quantity: item.quantity,
        "Unit Price": item.price,
        "Total Price": item.quantity * item.price,
        Customer: formatCustomerId(kot.customerId),
        "Payment Method": kot.methodOfPayment,
        "Employee Name": getUserName(kot.userId), // Changed to display user name
      }))
    );
  };

  const downloadCSV = () => {
    const rows = [
      ["Employee Name", "Employee ID", "Check-In", "Check-Out", "Worked For"],
      ...attendanceData.map((log) => [
        log.empName,
        log.empId,
        log.checkIn,
        log.checkOut,
        log.worked,
      ]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Report_${selectedDate}.csv`;
    link.click();
  };

  const formatKOTCSVData = () => {
    return kotHistory.map((kot) => ({
      "KOT ID": kot.kot_id,
      Date: kot.date.toLocaleDateString(),
      Time: kot.date.toLocaleTimeString(),
      "Customer ID": formatCustomerId(kot.customerId),
      Amount: `£${Number(kot.amount || 0).toFixed(2)}`,
      "Payment Method": kot.methodOfPayment,
      "Earned Points": kot.earnedPoints,
      "Items Count": kot.items.length,
      "Cashier Name": getUserName(kot.userId), // Changed to display user name
    }));
  };

  const handlePrint = useReactToPrint({
    content: () => reportRef.current,
    pageStyle: `
      @page { size: auto; margin: 5mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f3f4f6 !important; }
        tr:nth-child(even) { background-color: #f9fafb !important; }
      }
    `,
    documentTitle: `Report_${selectedDate}`,
  });

  const formatCustomerId = (customerId) => {
    if (!customerId) return "Walk-in";
    // Assuming customerId from Firestore might be "customers/cus01"
    // If input is just "cus01", split might not be needed.
    // Let's make it robust to handle both "customers/ID" and "ID"
    const parts = customerId.split("/");
    return parts.length > 1 ? parts[1] : customerId;
  };

  const filteredData = attendanceData.filter((log) =>
    log.empName.toLowerCase().includes(empNameFilter.toLowerCase())
  );

  const handleClose = () => {
    logout(); // Added logout on close
    navigate("/");
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
        <button
          onClick={handleClose}
          className="fixed top-5 right-7 bg-gray-600 text-white border-none text-2xl px-3 py-1 rounded-full cursor-pointer z-[9999] hover:bg-gray-800"
        >
          X
        </button>

        <div className="bg-white shadow-md p-6 rounded w-full max-w-sm">
          <h2 className="text-2xl font-semibold mb-4 text-center">
            Manager Login
          </h2>
          <input
            type="text"
            placeholder="Enter employee ID"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="p-2 border border-gray-300 rounded w-full mb-4 text-center"
          />

          <button
            onClick={handleManagerLogin}
            disabled={authLoading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {authLoading ? "Logging in..." : "Login"}
          </button>
        </div>
      </div>
    );
  }

  // Show reports if authenticated
  return (
    <div className="container">
      {currentView === "home" && (
        <div className="cards-view">
          <button className="close-btn" onClick={handleClose}>
            ×
          </button>

          <div className="cards">
            <div className="card" onClick={() => setCurrentView("attendance")}>
              Attendance Report
            </div>
            <div className="card" onClick={() => setCurrentView("kot")}>
              KOT Report
            </div>
            <div className="card" onClick={() => setCurrentView("sales")}>
              Sales Report
            </div>
          </div>
        </div>
      )}

      {currentView === "sales" && (
        <div>
          <div className="filters-grid">
            {/* Date Range Filter */}
            <div className="filter-group">
              <label>Date Range:</label>
              <DatePicker
                selected={salesStartDate}
                onChange={(date) => {
                  setSalesStartDate(startOfDay(date));
                  setSelectedPeriod("custom");
                }}
                selectsStart
                startDate={salesStartDate} // Changed from startDate to salesStartDate for consistency
                endDate={salesEndDate}   // Changed from endDate to salesEndDate for consistency
                dateFormat={DATE_FORMAT}
                className="date-picker"
              />
              <DatePicker
                selected={salesEndDate}
                onChange={(date) => {
                  setSalesEndDate(endOfDay(date));
                  setSelectedPeriod("custom");
                }}
                selectsEnd
                startDate={salesStartDate} // Changed from startDate to salesStartDate for consistency
                endDate={salesEndDate}   // Changed from endDate to salesEndDate for consistency
                minDate={salesStartDate} // Changed from startDate to salesStartDate for consistency
                dateFormat={DATE_FORMAT}
                className="date-picker"
              />
            </div>

            {/* Category Filter */}
            <div className="filter-group">
              <label>Category:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Type Filter */}
            <div className="filter-group">
              <label>Order Type:</label>
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="dine-in">Dine-In</option>
                <option value="takeaway">Takeaway</option>
                {/* <option value="delivery">Delivery</option> */}
              </select>
            </div>

            <div className="filter-group">
              <label>Period:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="filter-select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="filter-group">
              <label>Payment Method:</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            {/* Customer Filter */}
            <div className="filter-group">
              <label>Customer ID:</label>
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="Search customer..."
                className="filter-input"
              />
            </div>

            {/* Item Name Filter */}
            <div className="filter-group">
              <label>Item Name:</label>
              <input
                type="text"
                value={itemNameFilter}
                onChange={(e) => setItemNameFilter(e.target.value)}
                placeholder="Search items..."
                className="filter-input"
              />
            </div>
          </div>

          <div className="summary-cards">
            <div className="summary-card">
              <h3>Total Sales</h3>
              <p>
                {CURRENCY_SYMBOL}
                {Number(summaryData.totalSales).toFixed(2)}
              </p>
            </div>
            <div className="summary-card">
              <h3>Total Orders</h3>
              <p>{summaryData.totalOrders}</p>
            </div>
            <div className="summary-card">
              <h3>Bestseller</h3>
              <p>
                {summaryData.bestseller?.name || "N/A"}(
                {summaryData.bestseller?.count || 0})
              </p>
            </div>
            <div className="summary-card">
              <h3>Least Sold</h3>
              <p>
                {summaryData.leastSold?.name || "N/A"}(
                {summaryData.leastSold?.count || 0})
              </p>
            </div>
            <div className="summary-card">
              <h3>Average Daily Sales</h3>
              <p>
                {CURRENCY_SYMBOL}
                {Number(summaryData.averageDailySales).toFixed(2)}
              </p>
            </div>
            <div className="summary-card">
              <h3>Avg. per Order</h3>
              <p>
                {CURRENCY_SYMBOL}
                {Number(summaryData.averagePerOrder).toFixed(2)}
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Order Type</th>
                <th>Payment Method</th>
                <th>Cashier</th>
                <th>User</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.flatMap((kot) =>
                kot.items.map((item, index) => (
                  <tr key={`${kot.id}-${index}`}>
                    <td>{item.name || "Unknown Item"}</td>
                    <td>{itemCategoryMap[item.name] || "Uncategorized"}</td> {/* Changed to use itemCategoryMap */}

                    <td>{item.quantity}</td>
                    <td>
                      {CURRENCY_SYMBOL}
                      {(Number(item.price) || 0).toFixed(2)}
                    </td>
                    <td>
                      {CURRENCY_SYMBOL}
                      {(
                        (Number(item.quantity) || 0) * (Number(item.price) || 0)
                      ).toFixed(2)}
                    </td>
                    <td>{kot.orderType || "Unknown"}</td>
                    <td>{kot.methodOfPayment || "Unknown"}</td>
                    <td>{kot.cashierName|| "Unknown"}</td>
                    <td>{kot.customerID}</td>
                    <td>{format(kot.date, "HH:mm:ss")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="export-options sticky bottom-0 bg-white z-10 p-4 shadow-md flex justify-end gap-2">
            <CSVLink
              data={formatSalesCSVData()}
              filename={`Sales_Report_${format(new Date(), DATE_FORMAT)}.csv`}
            >
              <button className="export-btn">Export to CSV</button>
            </CSVLink>
            <button className="export-btn" onClick={handlePrintReport}>
              Print Report
            </button>
            <button className="export-btn" onClick={() => setCurrentView("home")}>
              Back
            </button>
          </div>

          <style jsx>{`
            .filters-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 1rem;
              margin-bottom: 2rem;
            }

            .filter-group {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }

            .date-picker {
              width: 100%;
              padding: 0.5rem;
              border: 1px solid #ccc;
              border-radius: 4px;
            }

            .filter-select {
              padding: 0.5rem;
              border: 1px solid #ccc;
              border-radius: 4px;
            }

            .filter-input {
              padding: 0.5rem;
              border: 1px solid #ccc;
              border-radius: 4px;
              width: 100%;
            }

            .summary-cards {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 1rem;
              margin: 2rem 0;
            }

            .summary-card {
              background: #f8f9fa;
              border-radius: 8px;
              padding: 1.5rem;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              text-align: center;
            }

            .summary-card h3 {
              color: #2c3e50;
              margin-bottom: 0.5rem;
              font-size: 1.1rem;
            }

            .summary-card p {
              font-size: 1.4rem;
              font-weight: bold;
              color: #27ae60;
              margin: 0;
            }

            .export-options {
              margin-top: 2rem;
              display: flex;
              gap: 1rem;
              flex-wrap: wrap;
              justify-content: center;
            }

            .export-btn {
              padding: 0.75rem 1.5rem;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              transition: background-color 0.3s;
            }

            .export-btn:hover {
              background-color: #0056b3;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 1rem;
            }

            th,
            td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }

            th {
              background-color: #f8f9fa;
              font-weight: 600;
            }

            td {
              background-color: #fafafa;
            }
          `}</style>
        </div>
      )}

      {currentView === "attendance" && (
        <div>
          <h1>Attendance Report for {selectedDate}</h1>

          <div className="filters">
            <label>
              Select Date:
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>

            <label>
              Employee Name:
              <input
                type="text"
                value={empNameFilter}
                placeholder="Search by name"
                onChange={(e) => setEmpNameFilter(e.target.value)}
              />
            </label>

            <button onClick={downloadCSV} className="btn">
              Download CSV
            </button>
            <button onClick={() => fetchAttendanceData()} className="btn">
              Refresh
            </button>
            <button onClick={() => setCurrentView("home")} className="btn">
              Back
            </button>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Employee ID</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Worked For</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5">No attendance logs found.</td>
                  </tr>
                ) : (
                  filteredData.map((log, index) => (
                    <tr key={index}>
                      <td>{log.empName}</td>
                      <td>{log.empId}</td>
                      <td>{log.checkIn}</td>
                      <td>{log.checkOut}</td>
                      <td>{log.worked}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {currentView === "kot" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h1>KOT Report for {selectedDate}</h1>
          </div>

          <div className="filters">
            <label>
              Select Date:
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </label>

            <label>
              Payment Method:
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            </label>

            <label>
              Customer ID:
              <input
                type="text"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="e.g., cus01"
              />
            </label>

            <CSVLink
              data={formatKOTCSVData()}
              filename={`KOT_Report_${selectedDate}.csv`}
              className="btn"
            >
              Download CSV
            </CSVLink>

            <button onClick={() => fetchKOTHistory()} className="btn">
              Refresh
            </button>
            <button onClick={() => setCurrentView("home")} className="btn">
              Back
            </button>
          </div>

          <div ref={reportRef}>
            {loading ? (
              <div>Loading KOT data...</div>
            ) : kotHistory.length === 0 ? (
              <div>No KOTs found for selected date</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>KOT ID</th>
                    <th>Date/Time</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Points</th>
                    <th>Items</th>
                    <th>Cashier</th> {/* Changed header to Cashier */}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kotHistory.map((kot) => (
                    <tr key={kot.id}>
                      <td>{kot.kot_id}</td>
                      <td>
                        {kot.date.toLocaleDateString()}{" "}
                        {kot.date.toLocaleTimeString()}
                      </td>
                      <td>{formatCustomerId(kot.customerId)}</td>
                      <td>£{Number(kot.amount).toFixed(2)}</td>
                      <td>{kot.methodOfPayment || "unknown"}</td>
                      <td>{kot.earnedPoints}</td>
                      <td>{kot.items.length}</td>
                      <td>{getUserName(kot.userId)}</td> {/* Changed to display user name */}
                      <td>
                        <button
                          onClick={() => handleViewDetails(kot.id)}
                          className="view-btn"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {hasMore && !loading && (
            <button onClick={() => fetchKOTHistory(true)} className="btn">
              Load More
            </button>
          )}
        </div>
      )}

      {isDetailModalOpen && selectedKOT && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>KOT Details - {selectedKOT.kot_id}</h3>
              <button onClick={() => setIsDetailModalOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-semibold">Date:</p>
                  <p>{selectedKOT.date.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-semibold">Customer:</p>
                  <p>{formatCustomerId(selectedKOT.customerId)}</p>
                </div>
                <div>
                  <p className="font-semibold">Payment Method:</p>
                  <p>{selectedKOT.methodOfPayment || "unknown"}</p>
                </div>
                <div>
                  <p className="font-semibold">Cashier:</p> {/* Changed label to Cashier */}
                  <p>{getUserName(selectedKOT.userId)}</p> {/* Changed to display user name */}
                </div>
                <div>
                  <p className="font-semibold">Earned Points:</p>
                  <p>{selectedKOT.earnedPoints || 0}</p>
                </div>
                <div>
                  <p className="font-semibold">Total Amount:</p>
                  <p>£{Number(selectedKOT.amount).toFixed(2)}</p>
                </div>
              </div>

              <h4 className="font-bold">Items:</h4>
              {selectedKOT.items.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Item ID</th>
                      <th>Name</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedKOT.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.id}</td>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>£{Number(item.price).toFixed(2)}</td>
                        <td>
                          £{(item.quantity * Number(item.price)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No items found for this KOT</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          padding: 20px;
          font-family: Arial, sans-serif;
          position: relative;
        }

        .cards-view {
          position: relative;
        }

        .cards {
          display: flex;
          gap: 20px;
          justify-content: center;
          align-items: center;
          margin-top: 200px;
          flex-wrap: wrap;
        }

        .card {
          background-color: #007bff;
          color: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          width: 200px;
          height: 150px;
          cursor: pointer;
          font-size: 18px;
          transition: 0.3s;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: center;
          align-items: center;
          word-wrap: break-word;
        }

        .card:hover {
          background-color: #0056b3;
        }

        .close-btn {
          position: fixed;
          top: 20px;
          right: 30px;
          background: #ff4d4f;
          color: white;
          border: none;
          font-size: 24px;
          padding: 1px 10px;
          border-radius: 50%;
          cursor: pointer;
          z-index: 999;
        }

        .close-btn:hover {
          background: #cc0000;
        }

        h1 {
          margin-bottom: 20px;
        }

        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        input[type="date"],
        input[type="text"],
        select {
          padding: 6px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        .btn {
          padding: 8px 10px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn:hover {
          background-color: #0056b3;
        }

        .view-btn {
          padding: 6px 12px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .view-btn:hover {
          background-color: #218838;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        th,
        td {
          padding: 8px 12px;
          border: 1px solid #ddd;
          text-align: left;
        }

        th {
          background-color: rgb(114, 113, 113);
          color: white;
        }

        td {
          background-color: #fafafa;
        }

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 800px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        }

        .grid {
          display: grid;
        }

        .grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .gap-4 {
          gap: 1rem;
        }

        .mb-4 {
          margin-bottom: 1rem;
        }

        .font-semibold {
          font-weight: 600;
        }

        .font-bold {
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};

export default ReportPage;