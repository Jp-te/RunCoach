import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured } from './integrations/supabase/client';
import { HomeRedirect, PublicOnly, RequireRole } from './components/RouteGuards';
import { Spinner } from './components/ui/Misc';
import ProfessorLayout from './layouts/ProfessorLayout';
import AthleteLayout from './layouts/AthleteLayout';
import ConfigMissing from './pages/ConfigMissing';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Install from './pages/Install';

const Dashboard = lazy(() => import('./pages/professor/Dashboard'));
const Athletes = lazy(() => import('./pages/professor/Athletes'));
const AthleteDetail = lazy(() => import('./pages/professor/AthleteDetail'));
const Sheets = lazy(() => import('./pages/professor/Sheets'));
const SheetEditor = lazy(() => import('./pages/professor/SheetEditor'));
const Trainings = lazy(() => import('./pages/professor/Trainings'));
const Results = lazy(() => import('./pages/professor/Results'));
const Reports = lazy(() => import('./pages/professor/Reports'));
const TafList = lazy(() => import('./pages/professor/TafList'));
const TafExamPage = lazy(() => import('./pages/professor/TafExamPage'));
const ProfessorMessages = lazy(() => import('./pages/professor/Messages'));
const ProfessorSettings = lazy(() => import('./pages/professor/Settings'));
const ProfessorCalendar = lazy(() => import('./pages/professor/CalendarPage'));

const Today = lazy(() => import('./pages/athlete/Today'));
const MyWorkouts = lazy(() => import('./pages/athlete/MyWorkouts'));
const Progress = lazy(() => import('./pages/athlete/Progress'));
const MyPlan = lazy(() => import('./pages/athlete/MyPlan'));
const MyTaf = lazy(() => import('./pages/athlete/MyTaf'));
const AthleteCalendar = lazy(() => import('./pages/athlete/CalendarPage'));
const AthleteMessages = lazy(() => import('./pages/athlete/Messages'));
const Account = lazy(() => import('./pages/athlete/Account'));

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/instalar" element={<Install />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
        </Route>

        <Route element={<RequireRole role="professor" />}>
          <Route path="/professor" element={<ProfessorLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="atletas" element={<Athletes />} />
            <Route path="atletas/:id" element={<AthleteDetail />} />
            <Route path="planilhas" element={<Sheets />} />
            <Route path="planilhas/:id" element={<SheetEditor />} />
            <Route path="calendario" element={<ProfessorCalendar />} />
            <Route path="treinamentos" element={<Trainings />} />
            <Route path="resultados" element={<Results />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="taf" element={<TafList />} />
            <Route path="taf/:id" element={<TafExamPage />} />
            <Route path="mensagens" element={<ProfessorMessages />} />
            <Route path="configuracoes" element={<ProfessorSettings />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="atleta" />}>
          <Route path="/atleta" element={<AthleteLayout />}>
            <Route index element={<Today />} />
            <Route path="treinos" element={<MyWorkouts />} />
            <Route path="evolucao" element={<Progress />} />
            <Route path="plano" element={<MyPlan />} />
            <Route path="taf" element={<MyTaf />} />
            <Route path="calendario" element={<AthleteCalendar />} />
            <Route path="mensagens" element={<AthleteMessages />} />
            <Route path="conta" element={<Account />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
