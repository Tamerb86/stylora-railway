import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { trpc } from "@/lib/trpc";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { StripeTerminalProvider } from "@/contexts/StripeTerminalContext";
import { ThermalPrinterProvider } from "@/contexts/ThermalPrinterContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Services from "./pages/Services";
import Appointments from "./pages/Appointments";
import Employees from "@/pages/Employees";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Financial from "@/pages/Financial";
import AdvancedFinancialReports from "@/pages/AdvancedFinancialReports";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Loyalty from "@/pages/Loyalty";
import { Communications } from "@/pages/Communications";
import { BulkMessaging } from "@/pages/BulkMessaging";
import { CampaignAnalytics } from "@/pages/CampaignAnalytics";
import { EmailTemplates } from "@/pages/EmailTemplates";
import Analytics from "@/pages/Analytics";
import EmployeeDashboard from "@/pages/EmployeeDashboard";
import PublicBooking from "@/pages/PublicBooking";
import BookingSuccess from "@/pages/BookingSuccess";
import CaseStudy from "@/pages/CaseStudy";
import AboutUs from "@/pages/AboutUs";
import Testimonials from "@/pages/Testimonials";
import TimeClock from "@/pages/TimeClock";
import TimeClockAdmin from "@/pages/TimeClockAdmin";
import AttendanceReport from "@/pages/AttendanceReport";
import UXShowcase from "@/pages/UXShowcase";
import POS from "@/pages/POS";
import Orders from "@/pages/Orders";
import PrintReceipt from "@/pages/PrintReceipt";
import Refunds from "@/pages/Refunds";
import MyLeaves from "@/pages/MyLeaves";
import LeaveApprovals from "@/pages/LeaveApprovals";
import SalonHolidays from "@/pages/SalonHolidays";
import Backups from "@/pages/Backups";
import UnimicroSettings from "@/pages/UnimicroSettings";
import FikenSettings from "@/pages/FikenSettings";
import SaasAdminLogin from "./pages/SaasAdmin/SaasAdminLogin";
import SaasAdminOverview from "./pages/SaasAdmin/SaasAdminOverview";
import SaasAdminTenants from "./pages/SaasAdmin/SaasAdminTenants";
import SaasAdminTenantDetails from "./pages/SaasAdmin/SaasAdminTenantDetails";
import SaasAdminTenantOnboarding from "./pages/SaasAdminTenantOnboarding";
import ProtectedSaasAdminRoute from "./components/ProtectedSaasAdminRoute";
import SignUp from "./pages/SignUp";
import Contact from "./pages/Contact";
import { VerifyEmail } from "./pages/VerifyEmail";
import EmailVerificationRequired from "./pages/EmailVerificationRequired";
import SetupWizard from "./pages/SetupWizard";
import POSPayment from "./pages/POSPayment";
import PaymentHistory from "./pages/PaymentHistory";
import PaymentProviders from "./pages/PaymentProviders";
import ReaderManagement from "./pages/ReaderManagement";
import WalkInQueue from "./pages/WalkInQueue";
import QueueDisplay from "./pages/QueueDisplay";
import RefundManagement from "./pages/RefundManagement";
import POSFinancialReports from "./pages/POSFinancialReports";
import SmsPackageSelection from "@/pages/SmsPackageSelection";
import SmsUsageDashboard from "@/pages/SmsUsageDashboard";
import EmailUsageDashboard from "@/pages/EmailUsageDashboard";
import EmailInvoices from "@/pages/EmailInvoices";
import BillingAdminDashboard from "@/pages/BillingAdminDashboard";
import CancelBooking from "@/pages/CancelBooking";
import ModifyBooking from "@/pages/ModifyBooking";
import ComprehensiveReports from "@/pages/ComprehensiveReports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/signup" component={SignUp} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/email-verification-required" component={EmailVerificationRequired} />
      <Route path="/setup-wizard" component={SetupWizard} />
      <Route path="/book" component={PublicBooking} />
      <Route path="/book/success" component={BookingSuccess} />
      <Route path="/cancel-booking" component={CancelBooking} />
      <Route path="/modify-booking" component={ModifyBooking} />
      <Route path="/case-study" component={CaseStudy} />
      <Route path="/about" component={AboutUs} />
      <Route path="/testimonials" component={Testimonials} />
      <Route path="/contact" component={Contact} />
      <Route path="/timeclock" component={TimeClock} />
      <Route path="/timeclock-admin" component={TimeClockAdmin} />
      <Route path="/attendance" component={AttendanceReport} />
      <Route path="/ux-showcase" component={UXShowcase} />
      <Route path="/pos" component={POS} />
      <Route path="/orders" component={Orders} />
      <Route path="/refunds" component={Refunds} />
      <Route path="/refund-management" component={RefundManagement} />
      <Route path="/pos-reports" component={POSFinancialReports} />
      <Route path="/my-leaves" component={MyLeaves} />
      <Route path="/leave-approvals" component={LeaveApprovals} />
      <Route path="/holidays" component={SalonHolidays} />
      <Route path="/backups" component={Backups} />
      <Route path="/unimicro" component={UnimicroSettings} />
      <Route path="/fiken" component={FikenSettings} />
      <Route path="/sms-packages" component={SmsPackageSelection} />
      <Route path="/sms-usage" component={SmsUsageDashboard} />
      <Route path="/email-usage" component={EmailUsageDashboard} />
      <Route path="/email-invoices" component={EmailInvoices} />
      <Route path="/billing-admin" component={BillingAdminDashboard} />
      <Route path="/pos-payment" component={POSPayment} />
      <Route path="/payment-history" component={PaymentHistory} />
      <Route path="/payment-providers" component={PaymentProviders} />
      <Route path="/reader-management" component={ReaderManagement} />
      <Route path="/print-receipt/:orderId" component={PrintReceipt} />
      <Route path="/saas-admin/login" component={SaasAdminLogin} />
      <Route path="/saas-admin">
        <ProtectedSaasAdminRoute>
          <SaasAdminOverview />
        </ProtectedSaasAdminRoute>
      </Route>
      <Route path="/saas-admin/tenants/new">
        <ProtectedSaasAdminRoute>
          <SaasAdminTenantOnboarding />
        </ProtectedSaasAdminRoute>
      </Route>
      <Route path="/saas-admin/tenants/:tenantId">
        <ProtectedSaasAdminRoute>
          <SaasAdminTenantDetails />
        </ProtectedSaasAdminRoute>
      </Route>
      <Route path="/saas-admin/tenants">
        <ProtectedSaasAdminRoute>
          <SaasAdminTenants />
        </ProtectedSaasAdminRoute>
      </Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/services" component={Services} />
      <Route path="/appointments" component={Appointments} />
      <Route path="/walk-in-queue" component={WalkInQueue} />
      <Route path="/queue-display" component={QueueDisplay} />
      <Route path="/employees" component={Employees} />
      <Route path="/products" component={Products} />
      <Route path="/reports" component={Reports} />
      <Route path="/comprehensive-reports" component={ComprehensiveReports} />
      <Route path="/financial" component={Financial} />
      <Route path="/advanced-reports" component={AdvancedFinancialReports} />
      <Route path="/settings" component={Settings} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/loyalty" component={Loyalty} />
      <Route path="/communications" component={Communications} />
      <Route path="/bulk-messaging" component={BulkMessaging} />
      <Route path="/campaign-analytics" component={CampaignAnalytics} />
      <Route path="/email-templates" component={EmailTemplates} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/employee" component={EmployeeDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <StripeTerminalProvider providerId={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""}>
          <ThermalPrinterProvider>
            <TooltipProvider>
              <ImpersonationBannerWrapper />
              <Router />
            </TooltipProvider>
          </ThermalPrinterProvider>
        </StripeTerminalProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ImpersonationBannerWrapper() {
  const { data: user } = trpc.auth.me.useQuery();
  
  // Show banner only if impersonatedTenantId is explicitly set in the session
  // This means the platform owner is actively impersonating another tenant
  const isImpersonating = user && user.impersonatedTenantId;
  
  if (!isImpersonating) return null;
  
  return <ImpersonationBanner />;
}

export default App;
