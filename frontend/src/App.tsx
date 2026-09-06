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
import TimeOffPage from './pages/TimeOffPage';
import TimeOffDetailPage from './pages/TimeOffDetailPage';
import AllocationsPage from './pages/AllocationsPage';
import AllocationDetailPage from './pages/AllocationDetailPage';
import TimeOffTypesPage from './pages/TimeOffTypesPage';
import TimeOffTypeDetailPage from './pages/TimeOffTypeDetailPage';
import PayrunsPage from './pages/PayrunsPage';
import PayrunDetailPage from './pages/PayrunDetailPage';
import PayslipsPage from './pages/PayslipsPage';
import PayslipDetailPage from './pages/PayslipDetailPage';
import SalaryStructuresPage from './pages/SalaryStructuresPage';
import SalaryStructureDetailPage from './pages/SalaryStructureDetailPage';
import SalaryRulesPage from './pages/SalaryRulesPage';
import SalaryRuleDetailPage from './pages/SalaryRuleDetailPage';
import PayrollDashboardPage from './pages/PayrollDashboardPage';
import MyProfilePage from './pages/MyProfilePage';
import MyAttendancePage from './pages/MyAttendancePage';
import MyTimeOffPage from './pages/MyTimeOffPage';
import MyPayslipsPage from './pages/MyPayslipsPage';
import MyPayslipDetailPage from './pages/MyPayslipDetailPage';

const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'] as const;

// Payroll is narrower than HR_STAFF: a plain HR Manager runs the people side
// but has no business seeing wages or payslips.
const PAYROLL_STAFF = ['admin', 'hr_payroll_manager', 'hr_payroll_user'] as const;

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
            path="/time-off"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <TimeOffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-off/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <TimeOffDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/allocations"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <AllocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/allocations/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <AllocationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-off-types"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <TimeOffTypesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-off-types/:id"
            element={
              <ProtectedRoute roles={[...HR_STAFF]}>
                <TimeOffTypeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payruns"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <PayrunsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payruns/:id"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <PayrunDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payslips"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <PayslipsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payslips/:id"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <PayslipDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll/dashboard"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <PayrollDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-structures"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <SalaryStructuresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-structures/:id"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <SalaryStructureDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-rules"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <SalaryRulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary-rules/:id"
            element={
              <ProtectedRoute roles={[...PAYROLL_STAFF]}>
                <SalaryRuleDetailPage />
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
          {/* Self-service - open to any authenticated account, no role
              check, since every user is an employee with their own
              attendance/time off/payslips regardless of what else they hold. */}
          <Route
            path="/me/profile"
            element={
              <ProtectedRoute>
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/me/attendance"
            element={
              <ProtectedRoute>
                <MyAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/me/time-off"
            element={
              <ProtectedRoute>
                <MyTimeOffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/me/payslips"
            element={
              <ProtectedRoute>
                <MyPayslipsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/me/payslips/:id"
            element={
              <ProtectedRoute>
                <MyPayslipDetailPage />
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
