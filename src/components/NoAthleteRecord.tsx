import { EmptyState } from './ui/Misc';

export default function NoAthleteRecord() {
  return (
    <div className="card">
      <EmptyState
        title="Cadastro de atleta não encontrado"
        text="Sua conta não está vinculada a um cadastro de atleta. Fale com o seu professor."
      />
    </div>
  );
}
