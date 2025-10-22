import { Navigate } from "react-router-dom";

const Dashboard = () => {
  // Redirect to contacts by default
  return <Navigate to="/dashboard/contacts" replace />;
};

export default Dashboard;
