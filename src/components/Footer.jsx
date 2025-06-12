import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/config";

export default function Footer() {
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleManagerClick = () => {
    navigate("/manager-login");
  };

  const handleReportClick = () => {
    navigate("/report");
  };
  const handleHelpClick = () => {
    navigate("/Help");
  };
  const handleRecallClick = () => {
    navigate("/recall-orders");
  };
  const handleRefundClick = async () => {
    const dayStatusDoc = await getDoc(doc(db, "dayStatus", "1"));
    const dayStatusData = dayStatusDoc.data();

    if (!dayStatusData?.isStarted) {
      alert("Day has not started yet");
      return;
    }
    navigate("/refund-orders");
  };

  return (
    <div className="flex flex-wrap justify-start gap-1">
      <button
        onClick={handleRefresh}
        className="bg-blue-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[120px]  h-[80px]"
      >
        REFRESH
        <br />
        SCREEN
      </button>

      <button
        onClick={handleRecallClick} // Updated handler
        className="bg-blue-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[120px] h-[80px]"
      >
        RECALL
        <br />
        ORDER
      </button>

      <button
        onClick={handleManagerClick}
        className="bg-red-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[140px]  h-[80px]"
      >
        MANAGER
        <br />
        SCREEN
      </button>

      <button
        onClick={handleHelpClick}
        className="bg-gray-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[90px] h-[80px]"
      >
        HELP
      </button>

      <button
        onClick={handleReportClick}
        className="bg-blue-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[120px] h-[80px]"
      >
        REPORT
      </button>
      <button
        onClick={handleRefundClick}
        className="bg-orange-600 text-white font-bold py-2 px-2 rounded shadow text-sm w-[120px] h-[80px]"
      >
        REFUND
      </button>
    </div>
  );
}
