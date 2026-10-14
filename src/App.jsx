import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import EquipmentDetails from "./pages/EquipmentDetails";
import AddListing from "./pages/AddListing";
import EditListing from "./pages/EditListing";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/equipment/:id" element={<EquipmentDetails />} />
      <Route path="/list-equipment" element={<AddListing />} />
      <Route path="/edit-listing/:id" element={<EditListing />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}