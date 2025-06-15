import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";

export default function RecallPage() {
  const navigate = useNavigate();
  const [pendingOrders, setPendingOrders] = useState([]);

  useEffect(() => {
    const loadPendingOrders = async () => {
      const q = query(
        collection(db, "pendingOrders"),
        where("status", "==", "pending"),
      );
      
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        expiresAt: doc.data().expiresAt.toDate()
      }));
      
      setPendingOrders(orders);
    };

    loadPendingOrders();
  }, []);

// In RecallPage.jsx - Update handleRecallOrder
const handleRecallOrder = async (order) => {
  try {
    navigate("/", { 
      state: { 
        recalledOrder: {
          ...order, // Spread existing order properties
          id: order.id,// Add order ID for status update
          items: order.items,
          customerId: order.customerId,  // Original stored values
          employeeId: order.employeeId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          isEmployee: order.isEmployee,
          creditsUsed: order.creditsUsed,
          cashDue: order.cashDue
        }
      }
    });
    console.log(order.id);
  } catch (error) {
    console.error("Error recalling order:", error);
    alert("Failed to recall order");
  }
};

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Stored Orders</h1>
      
      <div className="grid gap-4">
        {pendingOrders.length === 0 ? (
          <p className="text-gray-500">No stored orders available</p>
        ) : (
          pendingOrders.map((order) => (
            <div key={order.id} className="border p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Order #{order.id}</h3>
                  <p className="text-sm">
                    {order.isEmployee ? "Employee" : "Customer"}: {order.customerName}
                  </p>
                  <p className="text-sm">Total: £{order.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(order.expiresAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRecallOrder(order)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Load Order
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => navigate(-1)}
        className="mt-6 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
      >
        Back to Main Screen
      </button>
    </div>
  );
}