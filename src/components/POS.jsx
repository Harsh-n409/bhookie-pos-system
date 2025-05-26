import Header from "./Header";
import MenuGrid from "./MenuGrid";
import EmployeeCashTab from "./EmployeeCashTab";
import KOTPanel from "./KOTPanel";
import PaymentScreen from "./PaymentScreen";
import Footer from "./Footer";
import { useState, useEffect, useMemo } from "react";
import { db } from "../firebase/config";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

export default function POS() {
  const [kotItems, setKotItems] = useState([]);
  const [showCashTab, setShowCashTab] = useState(false);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [appliedOffers, setAppliedOffers] = useState([]);
  
  // --- NEW STATE FOR PAYMENT SCREEN ---
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const [isEmployeePaying, setIsEmployeePaying] = useState(false); // You'll need to set this based on actual employee login/role
  // --- END NEW STATE ---

  const cashierId = "1234"; // This should ideally come from user authentication (e.g., Firebase Auth)

  useEffect(() => {
    // Only reset discounts if all items are removed
    if (kotItems.length === 0) {
      setTotalDiscount(0);
      setAppliedOffers([]);
    }
  }, [kotItems]);

  // --- NEW: Calculate Total Amount to be paid ---
  const calculateTotalBill = useMemo(() => {
    const subtotal = kotItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Ensure discount isn't more than subtotal
    const effectiveDiscount = Math.min(subtotal, totalDiscount); 
    return parseFloat((subtotal - effectiveDiscount).toFixed(2));
  }, [kotItems, totalDiscount]);

  const checkCashierStatusBeforeOpening = async () => {
    try {
      const q = query(
        collection(db, "cashierAttendance"),
        where("cashierId", "==", cashierId),
        where("isSignedIn", "==", true)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Cashier is not signed in. Cannot start session.");
        return false;
      }

      const cashierData = snapshot.docs[0].data();
      if (!cashierData.isOpen) {
        alert("Cashier is closed. Cannot start session.");
        return false;
      }

      return true;
    } catch (error) {
      console.error(error);
      alert("Error checking cashier status.");
      return false;
    }
  };

  const handleOpenCashTab = async () => {
    const allowed = await checkCashierStatusBeforeOpening();
    if (allowed) {
      setShowCashTab(true);
    }
  };

  // --- NEW: Function to initiate payment ---
  const handleInitiatePayment = () => {
    if (kotItems.length === 0) {
        alert("Please add items to the KOT before proceeding to payment.");
        return;
    }
    setShowPaymentScreen(true);
  };

  // --- NEW: Handle Payment Completion ---
  const handlePaymentComplete = async (paymentDetails) => {
    console.log("Payment Completed:", paymentDetails);
    
    // Here's where you would send the transaction data to your backend (Firebase in this case)
    try {
      // You'll want to structure your transaction object carefully
      const transactionData = {
        timestamp: new Date(),
        cashierId: cashierId, // Replace with actual dynamic cashier ID from auth
        items: kotItems.map(item => ({ // Store a simplified version of items
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            sauces: item.sauces || []
        })),
        subtotal: kotItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        totalDiscount: totalDiscount,
        appliedOffers: appliedOffers,
        finalBillAmount: paymentDetails.totalBillAmount, // The amount the customer owes
        // For tenderedAmount, you can either sum all tendered amounts or just use the last one for change calculation context
        tenderedAmount: paymentDetails.payments.reduce((sum, p) => sum + p.tenderedAmount, 0),
        changeGiven: paymentDetails.finalChangeDue, // Change given for cash
        paymentMethod: paymentDetails.payments.map(p => p.method).join(', '), // e.g., "Cash", "Card", or "Cash, Card" for mixed
        paymentsBreakdown: paymentDetails.payments, // Array of partial payments if applicable
        status: "Completed",
        // Add any other relevant transaction details (e.g., customer info, table number etc.)
      };

      // Save to Firebase (adjust collection name as needed, e.g., "transactions")
      await addDoc(collection(db, "transactions"), transactionData);
      console.log("Transaction saved to Firebase!");

      // --- KOT Printing Logic (to be implemented more robustly) ---
      // This is a placeholder. You'd likely send this data to a printer service or generate a printable view.
      alert(`Payment successful! 
              Total: £${paymentDetails.totalBillAmount.toFixed(2)} 
              Tendered: £${paymentDetails.payments.reduce((sum, p) => sum + p.tenderedAmount, 0).toFixed(2)} 
              Change: £${paymentDetails.finalChangeDue.toFixed(2)}
              Method: ${paymentDetails.payments.map(p => p.method).join(', ')}`);

      // Clear the KOT after successful transaction
      setKotItems([]);
      setTotalDiscount(0);
      setAppliedOffers([]);
      setShowPaymentScreen(false); // Close the payment screen
    } catch (error) {
      console.error("Error processing payment or saving transaction:", error);
      alert("Error processing payment. Please try again.");
      // You might want to keep the payment screen open or show a specific error.
    }
  };

  return (
    <div>
      <Header />
      <div className="flex" /* flex-col h-screen - This class was incomplete or commented out */>
        <MenuGrid
          onAddItem={(item) => {
            setKotItems((prevItems) => {
              const existingIndex = prevItems.findIndex(
                (i) =>
                  i.id === item.id &&
                  JSON.stringify(i.sauces || []) ===
                    JSON.stringify(item.sauces || [])
              );

              if (existingIndex !== -1) {
                const updated = [...prevItems];
                updated[existingIndex].quantity += 1;
                return updated;
              }
              // Ensure quantity is set for new items if not already present
              return [...prevItems, { ...item, quantity: 1 }]; 
            });
            
          }}
          
          onApplyOffer={(discount, offer) => {
            setTotalDiscount((prev) => prev + discount);
            setAppliedOffers((prev) => [...prev, offer]);
          }}
          appliedOffers={appliedOffers}
        />
        <div className="w-[30%] lg:w-[40%] overflow-y-auto">
          <KOTPanel
            kotItems={kotItems}
            setKotItems={setKotItems}
            // --- MODIFICATION: Pass handleInitiatePayment to KOTPanel ---
            // Assuming KOTPanel has a "Pay" or "Checkout" button that triggers payment
            setShowCashTab={handleOpenCashTab} // Keep this if EmployeeCashTab is still needed
            onProceedToPayment={handleInitiatePayment} // New prop for payment initiation
            totalDiscount={totalDiscount}
            appliedOffers={appliedOffers}
            onRemoveOffer={(offerId) => {
              const offer = appliedOffers.find((o) => o.id === offerId);
              if (offer) {
                setTotalDiscount((prev) => prev - offer.discountAmount);
                setAppliedOffers((prev) =>
                  prev.filter((o) => o.id !== offerId)
                );
              }
            }}
          />
        </div>
      </div>
      <Footer />

      {showCashTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Cash Session</h2>
            <EmployeeCashTab onClose={() => setShowCashTab(false)} />
            <button
              onClick={() => setShowCashTab(false)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* --- NEW: Render PaymentScreen conditionally --- */}
      {showPaymentScreen && (
        <PaymentScreen
          amount={calculateTotalBill} // Pass the calculated total bill
          isEmployee={isEmployeePaying} // Pass employee status (you'll need to set this appropriately)
          onComplete={handlePaymentComplete} // Pass the new handler
          onClose={() => setShowPaymentScreen(false)} // Allow closing payment screen
        />
      )}
      {/* --- END NEW --- */}
    </div>
  );
}