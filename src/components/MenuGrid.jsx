import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, getDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export default function MenuGrid({ onAddItem = () => {} }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState({});
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [error, setError] = useState(null);
  const [sauceOptions, setSauces] = useState([]);
  const [showSaucePopup, setShowSaucePopup] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showOffers, setShowOffers] = useState(true);

  // Clickable items - lowercased for comparison
  const clickableItems = [
    "chicken bites",
    "chicken drumsticks",
    "manchurian bites",
    "vada pav",
    "bhaji pav",
    "veggie aloo tikki burger",
    "chicken spicy burger",
    "chai",
    "chicken spicy burger + chicken drumstick"
  ];

  // Sample offers data
  const offers = [
    {
      id: "offer1",
      title: "COMBO DEAL",
      description: "Chicken Spicy Burger + Drumstick",
      price: "£7.99",
      originalPrice: "£9.50",
      items: ["chicken spicy burger", "chicken drumsticks"],
      color: "bg-gradient-to-r from-red-600 to-orange-500"
    },
    {
      id: "offer2",
      title: "VEGGIE SPECIAL",
      description: "Vada Pav + Bhaji Pav",
      price: "£6.50",
      originalPrice: "£8.00",
      items: ["vada pav", "bhaji pav"],
      color: "bg-gradient-to-r from-green-600 to-emerald-500"
    },
    {
      id: "offer3",
      title: "SNACKS COMBO",
      description: "Chicken Bites + Manchurian Bites",
      price: "£5.99",
      originalPrice: "£7.50",
      items: ["chicken bites", "manchurian bites"],
      color: "bg-gradient-to-r from-purple-600 to-indigo-500"
    },
    {
      id: "offer4",
      title: "QUICK MEAL",
      description: "Veggie Burger + Chai",
      price: "£4.99",
      originalPrice: "£6.50",
      items: ["veggie aloo tikki burger", "chai"],
      color: "bg-gradient-to-r from-blue-600 to-cyan-500"
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categorySnap = await getDocs(collection(db, "category"));
        const categoryData = categorySnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCategories(categoryData);

        const itemsSnap = await getDocs(collection(db, "items"));
        const itemData = itemsSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            categoryId:
              data.categoryId?.id ||
              data.categoryId?.split("/").pop() ||
              null,
          };
        });
        setItems(itemData);

        // Set up real-time inventory listeners for each item
        itemData.forEach((item) => {
          const inventoryRef = doc(db, "inventory", item.id);
          const unsubscribe = onSnapshot(inventoryRef, (doc) => {
            setInventory(prev => ({
              ...prev,
              [item.id]: doc.exists() ? doc.data() : { totalStockOnHand: 9999 }
            }));
          });

          // Return cleanup function for the effect
          return () => unsubscribe();
        });
      } catch (err) {
        setError("Error loading menu data");
        console.error("Error loading menu data:", err);
      }
    };

    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => item.categoryId === selectedCategoryId);
  }, [items, selectedCategoryId]);

  const handleItemClick = async (item) => {
    setSelectedItem(item);
    try {
      if (item.sauces) {
        const sauceGroupSnap = await getDoc(item.sauces);
        if (sauceGroupSnap.exists()) {
          const sauceList = sauceGroupSnap.data().sauces || [];
          setSauces(sauceList);
          setShowSaucePopup(true);
          return;
        }
      }
      onAddItem({
        id: item.id,
        name: item.itemName,
        price: item.price,
        quantity: 1
      });
    } catch (err) {
      console.error("Error fetching sauces:", err);
      onAddItem({
        id: item.id,
        name: item.itemName,
        price: item.price,
        quantity: 1
      });
    }
  };

  const handleSelectSauce = (sauce) => {
    if (selectedItem) {
      onAddItem({
        id: selectedItem.id,
        name: selectedItem.itemName,
        price: selectedItem.price,
        sauces: sauce ? [sauce] : [],
        quantity: 1
      });
    }
    setShowSaucePopup(false);
    setSelectedItem(null);
  };

  const handleAddOffer = (offer) => {
    offer.items.forEach(itemName => {
      const item = items.find(i => i.itemName.toLowerCase() === itemName.toLowerCase());
      if (item) {
        onAddItem({
          id: item.id,
          name: item.itemName,
          price: item.price,
          quantity: 1
        });
      }
    });
  };

  const handleCategoryClick = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setShowOffers(false);
  };

  const handleShowOffers = () => {
    setSelectedCategoryId(null);
    setShowOffers(true);
  };

  return (
    <div className="flex flex-row w-full h-[calc(100vh-140px)] overflow-hidden">
      {/* Categories */}
      <div className="w-[180px] bg-purple-800 text-white p-2 flex flex-col gap-1 overflow-y-auto">
        <button
          onClick={handleShowOffers}
          className={`py-2 px-2 rounded text-left tracking-wide mb-2 ${
            showOffers && !selectedCategoryId
              ? "bg-white text-purple-800 font-bold"
              : "bg-purple-900 hover:bg-purple-600"
          } transition`}
        >
          🔥 OFFERS
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className={`py-2 px-2 rounded text-left tracking-wide ${
              selectedCategoryId === cat.id
                ? "bg-white text-purple-800 font-bold"
                : "bg-purple-700 hover:bg-purple-600"
            } transition`}
          >
            {cat.name?.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Items or Offers */}
      <div className="flex-1 p-4 bg-purple-100 overflow-y-auto">
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : selectedCategoryId ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-2">
            {filteredItems.map((item) => {
              const stock = inventory[item.id]?.totalStockOnHand;
              const isClickable = clickableItems.includes(item.itemName.toLowerCase()) && (stock === undefined || stock > 0);

              return (
                <button
                  key={item.id}
                  onClick={isClickable ? () => handleItemClick(item) : undefined}
                  disabled={!isClickable}
                  className={`rounded p-1 shadow-md text-white text-center flex flex-col justify-center items-center transition ${
                    isClickable ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                  style={{
                    backgroundColor:
                      item.itemName.toLowerCase().includes("chicken")
                        ? "#e60000"
                        : item.itemName.toLowerCase().includes("paneer")
                        ? "#1f3b73"
                        : "#22594c",
                  }}
                >
                  <div>{item.itemName.toUpperCase()}</div>
                  <div className="text-xl mt-3">£{item.price}</div>
                  {stock !== undefined && stock <= 0 && (
                    <div className="text-xs text-white-500 mt-1">Out of stock</div>
                  )}
                  {stock !== undefined && stock > 0 && stock < 10 && (
                    <div className="text-xs text-white-600 mt-1">Low stock: {stock} left</div>
                  )}
                </button>
              );
            })}
          </div>
        ) : showOffers ? (
          <div className="h-full">
            <h2 className="text-3xl font-bold mb-6 text-purple-900 text-center">TODAY'S SPECIAL OFFERS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className={`${offer.color} rounded-xl shadow-xl overflow-hidden text-white transform hover:scale-105 transition duration-300`}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">{offer.title}</h3>
                        <p className="text-lg mb-4">{offer.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-bold">{offer.price}</span>
                        <span className="block text-sm line-through opacity-80">{offer.originalPrice}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">SAVE {Math.round((parseFloat(offer.originalPrice.substring(1)) - parseFloat(offer.price.substring(1))) * 100 / parseFloat(offer.originalPrice.substring(1)))}%</span>
                      <button
                        onClick={() => handleAddOffer(offer)}
                        className="bg-white text-purple-800 px-4 py-2 rounded-lg font-bold hover:bg-purple-100 transition"
                      >
                        ADD TO ORDER
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-purple-900 text-lg">Select a category from the left menu to view all items</p>
            </div>
          </div>
        ) : (
          <div className="text-gray-800 font-medium text-lg">
            Select a category to view items
          </div>
        )}
      </div>

      {/* Sauce Popup */}
      {showSaucePopup && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-40">
          <div className="bg-white rounded-lg p-5 shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-5 text-purple-900">
              Select Sauce for {selectedItem.itemName}
            </h2>

            {sauceOptions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {sauceOptions.map((sauce, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSauce(sauce)}
                    className="bg-green-300 hover:bg-green-300 text-black px-3 py-3 rounded text-sm"
                  >
                    {sauce}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-gray-300 mb-3">No sauces available</div>
            )}

            <button
              onClick={() => handleSelectSauce(null)}
              className="mt-4 px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600"
            >
              No Sauce
            </button>

            <button
              onClick={() => {
                setShowSaucePopup(false);
                setSelectedItem(null);
              }}
              className="mt-2 ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}