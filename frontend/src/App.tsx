import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';
import AttendancePage from './pages/AttendancePage';
import WorkingSchedulesPage from './pages/WorkingSchedulesPage';
import WorkingScheduleDetailPage from './pages/WorkingScheduleDetailPage';

const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'] as const;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/employees"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <ContractsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <ContractDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/working-schedules"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <WorkingSchedulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/working-schedules/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <WorkingScheduleDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
