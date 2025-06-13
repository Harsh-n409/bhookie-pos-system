import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  runTransaction,
  updateDoc,
  increment,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AutoContext";
import { useNavigate } from "react-router-dom";

const roleMap = {
  cash01: "cashier",
  manage01: "manager",
  cashier: "cashier",
  manager: "manager",
  teamleader: "teamleader",
  admin: "admin",
};

export default function RefundPage() {
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrderAsc, setSortOrderAsc] = useState(true);
  const [selectedOrderInfo, setSelectedOrderInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState(null);
  const [refundedItems, setRefundedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, [filterDate]);

  const fetchOrders = async () => {
    try {
      let q = collection(db, "KOT");

      if (filterDate) {
        const [year, month, day] = filterDate.split("-");
        const selectedDate = new Date(year, month - 1, day);
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        const startTimestamp = Timestamp.fromDate(startOfDay);
        const endTimestamp = Timestamp.fromDate(endOfDay);
        q = query(
          q,
          where("date", ">=", startTimestamp),
          where("date", "<=", endTimestamp)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => {
        const orderData = doc.data();
        return {
          id: doc.id,
          ...orderData,
          // Ensure backward compatibility
          items: orderData.items.map((item) => ({
            ...item,
            // Fallback to original price if effectivePrice doesn't exist
            effectivePrice: item.effectivePrice || item.price,
          })),
        };
      });
      setOrders(data);
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const startRefund = (order) => {
    setIsRefundMode(true);
    setOriginalOrder(order);

    // Group items by offer
    const itemsByOffer = {};
    const standaloneItems = [];

    order.items.forEach((item) => {
      if (item.isOfferItem && item.offerId) {
        if (!itemsByOffer[item.offerId]) {
          itemsByOffer[item.offerId] = [];
        }
        itemsByOffer[item.offerId].push(item);
      } else {
        standaloneItems.push(item);
      }
    });

    // Create refundable units
    const refundableUnits = [
      ...standaloneItems.map((item) => ({
        ...item,
        type: "item",
        remainingQuantity: item.quantity - (item.refundedQuantity || 0),
        refundQuantity: 0,
      })),
    ];

    // Add offer groups
    Object.entries(itemsByOffer).forEach(([offerId, items]) => {
      const minRefundable = Math.min(
        ...items.map((i) => i.quantity - (i.refundedQuantity || 0))
      );

      refundableUnits.push({
        id: `offer-${offerId}`,
        name: `Offer: ${items[0].offerName || offerId}`, // Use offer name if available
        type: "offer",
        offerId,
        items,
        remainingQuantity: minRefundable,
        refundQuantity: 0,
        effectivePrice: items.reduce(
          (sum, item) => sum + (item.effectivePrice || item.price),
          0
        ),
      });
    });

    setRefundedItems(refundableUnits);
  };
  const processRefund = async () => {
    if (!originalOrder) return;

    setIsProcessing(true);
    try {
      const hasRefund = refundedItems.some((item) => item.refundQuantity > 0);
      if (!hasRefund) {
        alert("Please select items to refund");
        return;
      }

      // Prepare refund data
      const refundData = {
        originalOrderId: originalOrder.id,
        date: Timestamp.now(),
        items: [],
        refundAmount: 0,
        processedBy: originalOrder.cashierName,
      };

      // Process refund units
      refundedItems.forEach((unit) => {
        if (unit.refundQuantity > 0) {
          if (unit.type === "offer") {
            unit.items.forEach((item) => {
              refundData.items.push({
                id: item.id,
                name: item.name,
                price: item.effectivePrice || item.price,
                quantity: unit.refundQuantity,
                isOfferItem: true,
                offerId: unit.offerId,
              });
              refundData.refundAmount +=
                (item.effectivePrice || item.price) * unit.refundQuantity;
            });
          } else {
            refundData.items.push({
              id: unit.id,
              name: unit.name,
              price: unit.effectivePrice || unit.price,
              quantity: unit.refundQuantity,
            });
            refundData.refundAmount +=
              (unit.effectivePrice || unit.price) * unit.refundQuantity;
          }
        }
      });

      // Update KOT document
      const kotRef = doc(db, "KOT", originalOrder.id);
      await runTransaction(db, async (transaction) => {
        const kotDoc = await transaction.get(kotRef);
        if (!kotDoc.exists()) {
          throw new Error("Original order not found");
        }

        const kotData = kotDoc.data();
        const updatedItems = [...kotData.items];
        let totalRefundedAmount = 0;

        refundedItems.forEach((unit) => {
          if (unit.refundQuantity > 0) {
            if (unit.type === "offer") {
              unit.items.forEach((item) => {
                const index = updatedItems.findIndex((i) => i.id === item.id);
                if (index !== -1) {
                  const newQty =
                    (updatedItems[index].refundedQuantity || 0) +
                    unit.refundQuantity;
                  updatedItems[index].refundedQuantity = newQty;
                  updatedItems[index].refunded =
                    newQty === updatedItems[index].quantity;

                  totalRefundedAmount +=
                    (item.effectivePrice || item.price) * unit.refundQuantity;
                }
              });
            } else {
              const index = updatedItems.findIndex((i) => i.id === unit.id);
              if (index !== -1) {
                const newQty =
                  (updatedItems[index].refundedQuantity || 0) +
                  unit.refundQuantity;
                updatedItems[index].refundedQuantity = newQty;
                updatedItems[index].refunded =
                  newQty === updatedItems[index].quantity;

                totalRefundedAmount +=
                  (unit.effectivePrice || unit.price) * unit.refundQuantity;
              }
            }
          }
        });

        const isFullyRefunded = updatedItems.every(
          (item) => (item.refundedQuantity || 0) === item.quantity
        );

        transaction.update(kotRef, {
          items: updatedItems,
          refunded: isFullyRefunded,
          refundedAmount: (kotData.refundedAmount || 0) + totalRefundedAmount,
        });
      });

      // Update inventory
      for (const unit of refundedItems) {
        if (unit.refundQuantity > 0) {
          if (unit.type === "offer") {
            for (const item of unit.items) {
              const itemRef = doc(db, "inventory", item.id);
              await updateDoc(itemRef, {
                totalStockOnHand: increment(unit.refundQuantity),
              });
            }
          } else {
            const itemRef = doc(db, "inventory", unit.id);
            await updateDoc(itemRef, {
              totalStockOnHand: increment(unit.refundQuantity),
            });
          }
        }
      }

      // Reverse loyalty points
      if (originalOrder.customerID && !originalOrder.isEmployee) {
        const customerQuery = query(
          collection(db, "customers"),
          where("customerID", "==", originalOrder.customerID)
        );
        const snapshot = await getDocs(customerQuery);
        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          let totalPointsToDeduct = 0;

          refundedItems.forEach((unit) => {
            if (unit.refundQuantity > 0) {
              const itemQty = unit.quantity || 1;
              totalPointsToDeduct += Math.floor(
                originalOrder.earnedPoints * (unit.refundQuantity / itemQty)
              );
            }
          });

          await updateDoc(docRef, {
            points: increment(-totalPointsToDeduct),
          });
        }
      }

      // Reverse meal credits
      if (originalOrder.isEmployee && originalOrder.employeeId) {
        const empQuery = query(
          collection(db, "users_01"),
          where("employeeID", "==", originalOrder.employeeId)
        );
        const snapshot = await getDocs(empQuery);
        if (!snapshot.empty) {
          const empDoc = snapshot.docs[0];
          const mealRef = doc(db, "users_01", empDoc.id, "meal", "1");

          let totalCreditsToRestore = 0;
          refundedItems.forEach((unit) => {
            if (unit.refundQuantity > 0) {
              const itemQty = unit.quantity || 1;
              totalCreditsToRestore +=
                originalOrder.creditsUsed * (unit.refundQuantity / itemQty);
            }
          });

          await updateDoc(mealRef, {
            mealCredits: increment(totalCreditsToRestore),
          });
        }
      }

      // Save refund record
      await addDoc(collection(db, "refunds"), refundData);

      alert("Refund processed successfully!");
      setIsRefundMode(false);
      setOriginalOrder(null);
      setRefundedItems([]);
      fetchOrders();
    } catch (error) {
      console.error("Refund failed:", error);
      alert(`Refund processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const refundEntireOrder = async (order) => {
    if (!order) return;
    const confirm = window.confirm(
      "Are you sure you want to refund the entire order?"
    );
    if (!confirm) return;

    setIsProcessing(true);

    try {
      const kotRef = doc(db, "KOT", order.id);
      let refundAmount = 0;

      await runTransaction(db, async (transaction) => {
        const kotSnap = await transaction.get(kotRef);
        if (!kotSnap.exists()) throw new Error("Order no longer exists.");

        const kotData = kotSnap.data();

        // Create updated items array with full refund quantities
        const updatedItems = kotData.items.map((item) => {
          const remainingQty = item.quantity - (item.refundedQuantity || 0);
          refundAmount += remainingQty * item.effectivePrice;

          return {
            ...item,
            refundedQuantity: item.quantity, // Mark entire quantity as refunded
            refunded: true,
          };
        });

        // Update KOT with refunded quantities
        transaction.update(kotRef, {
          items: updatedItems,
          refunded: true,
          refundedAmount: (kotData.refundedAmount || 0) + refundAmount,
        });

        // Restock inventory
        for (const item of kotData.items) {
          const remainingQty = item.quantity - (item.refundedQuantity || 0);
          if (remainingQty > 0) {
            const itemRef = doc(db, "inventory", item.id);
            transaction.update(itemRef, {
              totalStockOnHand: increment(remainingQty),
            });
          }
        }

        // Reverse loyalty points
        if (kotData.earnedPoints && kotData.customerID && !kotData.isEmployee) {
          const customerQuery = query(
            collection(db, "customers"),
            where("customerID", "==", kotData.customerID)
          );
          const customerSnapshot = await getDocs(customerQuery);

          if (!customerSnapshot.empty) {
            const customerDoc = customerSnapshot.docs[0];
            const customerRef = doc(db, "customers", customerDoc.id);
            transaction.update(customerRef, {
              points: increment(-kotData.earnedPoints),
            });
          }
        }

        // Reverse employee credits
        if (kotData.creditsUsed && kotData.isEmployee && kotData.employeeId) {
          const employeeQuery = query(
            collection(db, "users_01"),
            where("employeeID", "==", kotData.employeeId)
          );
          const employeeSnapshot = await getDocs(employeeQuery);

          if (!employeeSnapshot.empty) {
            const employeeDoc = employeeSnapshot.docs[0];
            const mealRef = doc(db, "users_01", employeeDoc.id, "meal", "1");
            transaction.update(mealRef, {
              mealCredits: increment(kotData.creditsUsed),
            });
          }
        }

        // Create refund record
        const refundData = {
          originalOrderId: order.id,
          date: Timestamp.now(),
          items: kotData.items.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity - (item.refundedQuantity || 0),
          })),
          refundAmount: refundAmount,
          processedBy: kotData.cashierName,
          refundType: "full",
        };

        const refundRef = doc(collection(db, "refunds"));
        transaction.set(refundRef, refundData);
      });

      alert("Full order refund processed successfully!");
      fetchOrders(); // Refresh orders list
    } catch (error) {
      console.error("Full refund failed:", error);
      alert(`Full refund failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const refundEntireOffer = async (order) => {
  if (!order) return;
  
  // Find all offers in the order
  const offersInOrder = {};
  order.items.forEach(item => {
    if (item.associatedOffer) {
      if (!offersInOrder[item.associatedOffer]) {
        offersInOrder[item.associatedOffer] = {
          items: [],
          minRefundable: Infinity
        };
      }
      offersInOrder[item.associatedOffer].items.push(item);
      const remaining = item.quantity - (item.refundedQuantity || 0);
      if (remaining < offersInOrder[item.associatedOffer].minRefundable) {
        offersInOrder[item.associatedOffer].minRefundable = remaining;
      }
    }
  });

  // Check if there are any refundable offers
  const refundableOffers = Object.values(offersInOrder).filter(
    offer => offer.minRefundable > 0
  );

  if (refundableOffers.length === 0) {
    alert("No complete offers available for refund");
    return;
  }

  const confirmRefund = window.confirm(
    "Are you sure you want to refund all complete offers? Partial offers cannot be refunded."
  );
  if (!confirmRefund) return;

  setIsProcessing(true);

  try {
    const kotRef = doc(db, "KOT", order.id);

    await runTransaction(db, async (transaction) => {
      const kotSnap = await transaction.get(kotRef);
      if (!kotSnap.exists()) throw new Error("Order no longer exists.");

      const kotData = kotSnap.data();
      const updatedItems = [...kotData.items];
      let totalRefundAmount = 0;

      // Process each offer
      refundableOffers.forEach(offer => {
        const refundQty = offer.minRefundable;
        
        offer.items.forEach(offerItem => {
          const itemIndex = updatedItems.findIndex(
            item => item.id === offerItem.id
          );
          
          if (itemIndex !== -1) {
            // Calculate new refunded quantity
            const newRefundedQuantity = 
              (updatedItems[itemIndex].refundedQuantity || 0) + refundQty;
            
            // Update item
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              refundedQuantity: newRefundedQuantity,
              refunded: newRefundedQuantity === updatedItems[itemIndex].quantity
            };

            // Add to refund amount
            totalRefundAmount += 
              (offerItem.effectivePrice || offerItem.price) * refundQty;
          }
        });
      });

      // Update KOT document
      transaction.update(kotRef, {
        items: updatedItems,
        refundedAmount: (kotData.refundedAmount || 0) + totalRefundAmount,
        // Don't mark entire order as refunded unless all items are refunded
        refunded: updatedItems.every(item => item.refunded)
      });

      // Restock inventory
      refundableOffers.forEach(offer => {
        const refundQty = offer.minRefundable;
        offer.items.forEach(item => {
          const itemRef = doc(db, "inventory", item.id);
          transaction.update(itemRef, {
            totalStockOnHand: increment(refundQty)
          });
        });
      });

      // Reverse loyalty points for customers
      if (kotData.earnedPoints && kotData.customerID && !kotData.isEmployee) {
        const customerQuery = query(
          collection(db, "customers"),
          where("customerID", "==", kotData.customerID)
        );
        const customerSnapshot = await getDocs(customerQuery);

        if (!customerSnapshot.empty) {
          const customerDoc = customerSnapshot.docs[0];
          const customerRef = doc(db, "customers", customerDoc.id);
          
          // Calculate points to deduct proportionally
          const pointsRatio = totalRefundAmount / kotData.amount;
          const pointsToDeduct = Math.floor(kotData.earnedPoints * pointsRatio);
          
          transaction.update(customerRef, {
            points: increment(-pointsToDeduct)
          });
        }
      }

      // Reverse employee credits
      if (kotData.creditsUsed && kotData.isEmployee && kotData.employeeId) {
        const employeeQuery = query(
          collection(db, "users_01"),
          where("employeeID", "==", kotData.employeeId)
        );
        const employeeSnapshot = await getDocs(employeeQuery);

        if (!employeeSnapshot.empty) {
          const employeeDoc = employeeSnapshot.docs[0];
          const mealRef = doc(db, "users_01", employeeDoc.id, "meal", "1");
          
          // Calculate credits to restore proportionally
          const creditsRatio = totalRefundAmount / kotData.amount;
          const creditsToRestore = kotData.creditsUsed * creditsRatio;
          
          transaction.update(mealRef, {
            mealCredits: increment(creditsToRestore)
          });
        }
      }

      // Create refund record
      const refundData = {
        originalOrderId: order.id,
        date: Timestamp.now(),
        items: refundableOffers.flatMap(offer => 
          offer.items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.effectivePrice || item.price,
            quantity: offer.minRefundable,
            associatedOffer: item.associatedOffer
          }))
        ),
        refundAmount: totalRefundAmount,
        processedBy: order.cashierName,
        refundType: "offer-only"
      };

      const refundRef = doc(collection(db, "refunds"));
      transaction.set(refundRef, refundData);
    });

    alert("All complete offers refunded successfully!");
    fetchOrders(); // Refresh orders list
  } catch (error) {
    console.error("Offer refund failed:", error);
    alert(`Offer refund failed: ${error.message}`);
  } finally {
    setIsProcessing(false);
  }
};

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

        if (role === "manager" || role === "admin" || role === "teamleader") {
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

  const handleClose = () => {
    logout(); // Added logout on close
    navigate("/");
  };
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

  return (
    <div className="flex h-screen justify-center items-start overflow-auto bg-gray-50 px-4 py-8 relative">
      {/* Refund Panel Overlay */}
      {isRefundMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl">
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
              <h3 className="font-bold text-lg mb-2">Refund Mode</h3>
              <p className="font-semibold">
                Original Order: {originalOrder?.kot_id || originalOrder?.id}
              </p>
              <p className="text-sm text-gray-600">
                Customer: {originalOrder?.customerID || "Walk-in"}
              </p>
              <p className="text-sm text-gray-600">
                Date:{" "}
                {originalOrder?.date?.toDate()?.toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) || "N/A"}
              </p>

              <div className="mt-3 overflow-auto max-h-60">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2">Original Qty</th>
                      <th className="p-2">Already Refunded</th>
                      <th className="p-2">Remaining</th>
                      <th className="p-2">Refund Qty</th>
                      {/* Added Effective Price column */}
                      <th className="p-2">Effective Price</th>
                      <th className="p-2">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundedItems.map((item, index) => {
                      if (item.type === "offer") {
                        return (
                          <tr
                            key={index}
                            className="border-b hover:bg-gray-50 bg-yellow-50"
                          >
                            <td className="p-2 font-semibold" colSpan={4}>
                              {item.name} (Combo)
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingQuantity}
                                value={item.refundQuantity}
                                onChange={(e) => {
                                  const updated = [...refundedItems];
                                  const newValue = Math.min(
                                    Math.max(parseInt(e.target.value || 0), 0),
                                    item.remainingQuantity
                                  );
                                  updated[index].refundQuantity = newValue;
                                  setRefundedItems(updated);
                                }}
                                className="w-16 border p-1 text-center"
                                disabled={item.remainingQuantity === 0}
                              />
                            </td>
                            <td className="p-2 text-center">
                              £
                              {item.effectivePrice?.toFixed(2) ||
                                item.price.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              £
                              {(
                                (item.effectivePrice || item.price) *
                                item.refundQuantity
                              ).toFixed(2)}
                            </td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2">{item.name}</td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-center">
                              {item.refundedQuantity || 0}
                            </td>
                            <td className="p-2 text-center">
                              {item.remainingQuantity}
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={item.remainingQuantity}
                                value={item.refundQuantity}
                                onChange={(e) => {
                                  const updated = [...refundedItems];
                                  const newValue = parseInt(
                                    e.target.value || 0
                                  );
                                  updated[index].refundQuantity = Math.min(
                                    Math.max(newValue, 0),
                                    item.remainingQuantity
                                  );
                                  setRefundedItems(updated);
                                }}
                                className="w-16 border p-1 text-center"
                                disabled={item.remainingQuantity === 0}
                              />
                            </td>
                            <td className="p-2 text-center">
                              £
                              {item.effectivePrice?.toFixed(2) ||
                                item.price.toFixed(2)}
                            </td>
                            <td className="p-2 text-center">
                              £
                              {(
                                (item.effectivePrice || item.price) *
                                item.refundQuantity
                              ).toFixed(2)}
                            </td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-lg font-bold">
                  Total Refund: £
                  {refundedItems
                    .reduce(
                      (sum, item) =>
                        sum +
                        (item.effectivePrice || item.price) *
                          item.refundQuantity,
                      0
                    )
                    .toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsRefundMode(false);
                      setOriginalOrder(null);
                      setRefundedItems([]);
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
                    disabled={isProcessing}
                  >
                    Cancel Refund
                  </button>
                  <button
                    onClick={processRefund}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Process Refund"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Order Refund System
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-2 font-medium">Filter by Date:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <div>
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
                onClick={() => navigate(-1)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Back
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full border border-gray-200 text-sm">
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
                    (order.refundedAmount || 0) > 0 && !order.refunded;
                  const isSelected = selectedOrderInfo?.orderId === orderId;

                  return (
                    <React.Fragment key={orderId}>
                      <tr
                        className={`text-center border-t cursor-pointer ${
                          isSelected ? "bg-gray-100" : ""
                        }`}
                        // onClick={() =>
                        //   setSelectedOrderInfo(
                        //     isSelected
                        //       ? null
                        //       : {
                        //           orderId,
                        //           order,
                        //         }
                        //   )
                        // }
                      >
                        <td className="p-2 border">
                          {order.date?.toDate?.().toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) || "N/A"}
                        </td>
                        <td className="p-2 border">
                          {order.kot_id || order.id}
                        </td>
                        <td className="p-2 border">
                          {order.customerID || "N/A"}
                        </td>
                        <td className="p-2 border">{order.user_id || "N/A"}</td>
                        <td className="p-2 border">{totalItems || 0}</td>
                        <td className="p-2 border">
                          £
                          {(
                            Number(order.amount || 0) -
                            Number(order.refundedAmount || 0)
                          ).toFixed(2)}
                          {isPartiallyRefunded && (
                            <span className="text-yellow-600 text-xs block">
                              (Refunded: £
                              {Number(order.refundedAmount || 0).toFixed(2)})
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (order.refunded) return;
                                startRefund(order);
                              }}
                              className={`${
                                order.refunded
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-red-500 hover:bg-red-600"
                              } text-white px-3 py-1 rounded`}
                              disabled={order.refunded}
                            >
                              {order.refunded ? "Refunded" : "PARTIAL REFUND"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (order.refunded) return;
                                refundEntireOrder(order);
                              }}
                              className={`${
                                order.refunded || isProcessing
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-blue-500 hover:bg-blue-600"
                              } text-white px-3 py-1 rounded`}
                              disabled={order.refunded || isProcessing}
                            >
                              {order.refunded
                                ? "Refunded"
                                : isProcessing
                                ? "Processing..."
                                : "COMPLETE REFUND"}
                            </button>
                            {/* <button
                              onClick={() => refundEntireOffer(order)}
                              className={`${
                                order.refunded || isProcessing
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-purple-500 hover:bg-purple-600"
                              } text-white px-3 py-1 rounded`}
                              disabled={order.refunded || isProcessing}
                            >
                              REFUND OFFER ONLY
                            </button> */}
                          </div>
                        </td>
                      </tr>

                      {isSelected && (
                        <tr className="bg-gray-50 text-center">
                          <td colSpan={7} className="p-4 text-left">
                            <h4 className="font-semibold mb-2">
                              Order Details:
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h5 className="font-medium mb-1">
                                  Order Items:
                                </h5>
                                {order.items && order.items.length > 0 ? (
                                  <ul className="list-disc list-inside">
                                    {order.items.map((item, idx) => (
                                      <li key={idx} className="mb-1">
                                        <span className="font-medium">
                                          {item.name}
                                        </span>
                                        <div className="ml-4 text-sm">
                                          <div>Quantity: {item.quantity}</div>
                                          <div>
                                            Price: £{item.price.toFixed(2)}
                                          </div>
                                          <div>
                                            Total: £
                                            {(
                                              Number(item.price) *
                                              Number(item.quantity)
                                            ).toFixed(2)}
                                          </div>
                                          {item.refundedQuantity > 0 && (
                                            <div className="text-red-600">
                                              Refunded: {item.refundedQuantity}
                                            </div>
                                          )}
                                          {item.refunded && (
                                            <div className="text-red-600 font-semibold">
                                              FULLY REFUNDED
                                            </div>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>No items found for this order.</p>
                                )}
                              </div>
                              <div>
                                <h5 className="font-medium mb-1">
                                  Payment Info:
                                </h5>
                                <div className="text-sm">
                                  <div>
                                    Subtotal: £
                                    {order.subTotal?.toFixed(2) || "0.00"}
                                  </div>
                                  <div>
                                    Tax: £{order.tax?.toFixed(2) || "0.00"}
                                  </div>
                                  <div>
                                    Discount: £
                                    {order.discount?.toFixed(2) || "0.00"}
                                  </div>
                                  <div className="font-bold mt-1">
                                    Total: £{order.amount?.toFixed(2) || "0.00"}
                                  </div>
                                  <div className="mt-2">
                                    Payment Method:{" "}
                                    {order.paymentMethod || "N/A"}
                                  </div>
                                  <div className="mt-2">
                                    Cashier: {order.cashierName || "N/A"}
                                  </div>
                                </div>
                              </div>
                            </div>
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
      </div>
    </div>
  );
}
