<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>🍔 Bhookie POS System 🍟</h1>

    

  <p>Bhookie POS is a modern, customizable point-of-sale system designed specifically for Quick Service Restaurant (QSR) environments such as fast food chains. The system streamlines high-volume food service operations with speed, simplicity, and minimal staff training. It supports dine-in, takeaway, integrated employee systems, real-time inventory, and analytics.</p>
<a href="https://bhookiepossystem.web.app/" target="_blank">Access the site here</a>

   <h2>✨ Features</h2>
   <ul class="feature-list">
        <li><strong>Customizable Menu:</strong> Easily manage and update menu items.</li>
        <li><strong>Order Management:</strong> Handle dine-in and takeaway orders efficiently.</li>
        <li><strong>Loyalty Program:</strong> Manage customer loyalty points and discounts.</li>
        <li><strong>Employee Management:</strong> Track employee meal credits and attendance.</li>
        <li><strong>Real-time Inventory:</strong> Monitor inventory levels in real-time.</li>
        <li><strong>Reporting and Analytics:</strong> Generate sales, KOT, and attendance reports.</li>
        <li><strong>Multi-branch Operations:</strong> Central management of users, menu, and pricing.</li>
    </ul>
    <h2>🛠 Installation</h2>

  <h3>Prerequisites</h3>
    <ul class="feature-list">
        <li>Node.js</li>
        <li>npm or yarn</li>
        <li>Firebase account and project setup</li>
    </ul>
    <h3>Setup</h3>
    <ol>
        <li><strong>Clone the Repository:</strong>
            <pre><code>git clone https://github.com/yourusername/bhookie-pos.git
cd bhookie-pos</code></pre>
        </li>
        <li><strong>Install Dependencies:</strong>
            <pre><code>npm install</code></pre>
        </li>
        <li><strong>Firebase Configuration:</strong>
            <ul>
                <li>Create a Firebase project and set up Firestore, Authentication, and any other required services.</li>
                <li>Update the Firebase configuration in <code>src/firebase/firebaseConfig.js</code> with your project details.</li>
            </ul>
        </li>
        <li><strong>Run the Application:</strong>
            <pre><code>npm start</code></pre>
        </li>
    </ol>

   <h2>🚀 Usage</h2>

   <h3>Running the Application</h3>
    <ol>
        <li><strong>Start the Development Server:</strong>
            <pre><code>npm start</code></pre>
            This will start the application on <a href="http://localhost:3000">http://localhost:3000</a>.
        </li>
        <li><strong>Access the Application:</strong>
            <ul>
                <li>Open your web browser and navigate to <a href="http://localhost:3000">http://localhost:3000</a>.</li>
                <li>Log in using your employee ID or manager credentials.</li>
            </ul>
        </li>
    </ol>

  <h3>Key Components</h3>
    <ul class="feature-list">
        <li><strong>Header:</strong> Displays real-time date and time, and greets the authenticated user.</li>
        <li><strong>POS:</strong> Main component for managing orders, KOT generation, and cashier sessions.</li>
        <li><strong>MenuGrid:</strong> Displays menu items and offers, allowing users to select items and add them to an order.</li>
        <li><strong>KOTPanel:</strong> Manages the order workflow from item selection to payment processing.</li>
        <li><strong>ManagerLogin:</strong> Provides a login interface for managers and employees.</li>
        <li><strong>ReportPage:</strong> Consolidates reporting for sales, KOTs, and employee attendance.</li>
        <li><strong>Footer:</strong> Provides quick-access buttons for essential system actions.</li>
        <li><strong>Help:</strong> Serves as a comprehensive help center for the POS system.</li>
        <li><strong>RecallPage:</strong> Acts as a temporary order recovery interface.</li>
        <li><strong>EmployeeCashTab:</strong> Controls the lifecycle of a cash-drawer session.</li>
    </ul>

   <h2>📁 Folder Structure</h2>
   <ul>
        <li><strong>src/:</strong> Contains the main source code for the application.
            <ul>
                <li><strong>components/:</strong> Reusable components like <code>Header</code>, <code>Footer</code>, <code>MenuGrid</code>, etc.</li>
                <li><strong>firebase/:</strong> Firebase configuration and initialization files.
                    <ul>
                        <li><strong>firebaseConfig.js:</strong> Configuration file for Firebase services.</li>
                        <li><strong>firestoreService.js:</strong> Functions for interacting with Firestore.</li>
                    </ul>
                </li>
                <li><strong>App.js:</strong> Main application component.</li>
                <li><strong>index.js:</strong> Entry point for the application.</li>
            </ul>
        </li>
    </ul>

  <h2>🤝 Contributing</h2>
    <p>We welcome contributions to the Bhookie POS System. To contribute:</p>
    <ol>
        <li>Fork the repository.</li>
        <li>Create a new branch for your feature or bug fix.</li>
        <li>Commit your changes and push to your fork.</li>
        <li>Submit a pull request with a detailed description of your changes.</li>
    </ol>

   <h2>📜 License</h2>
    <p>This project is licensed under the MIT License. See the <a href="LICENSE">LICENSE</a> file for details.</p>

   <h2>📧 Contact</h2>
    <p>For any questions or feedback, please contact us at <a href="jagveerkaurkhalsa@gmail.com">Here</a>.</p>
</body>
</html>
