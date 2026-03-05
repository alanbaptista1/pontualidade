export interface SecullumBank {
  id: number;
  identificador: string;
  nome: string;
  servidor: number;
  [key: string]: unknown;
}

export interface SecullumDepartamento {
  Id: number;
  Descricao: string;
  Nfolha?: string;
}

export interface SecullumHorarioDia {
  Id: number;
  HorarioId: number;
  DiaSemana: number;
  Entrada1: string | null;
  Saida1: string | null;
  Entrada2: string | null;
  Saida2: string | null;
  Entrada3: string | null;
  Saida3: string | null;
  Entrada4: string | null;
  Saida4: string | null;
  Entrada5: string | null;
  Saida5: string | null;
  ToleranciaFalta: number;
  ToleranciaExtra: number;
}

export interface SecullumHorario {
  Id: number;
  Numero: number;
  Descricao: string;
  Dias: SecullumHorarioDia[];
  [key: string]: unknown;
}

export interface SecullumFuncionario {
  Id: number;
  Nome: string;
  NumeroFolha: string;
  NumeroPis: string;
  Cpf: string | null;
  HorarioId: number;
  Horario: {
    Id: number;
    Numero: number;
    Descricao: string;
  };
  DepartamentoId: number;
  Departamento: {
    Id: number;
    Descricao: string;
  };
  Funcao?: {
    Id: number;
    Descricao: string;
  };
  Demissao: string | null;
  Invisivel: boolean;
  [key: string]: unknown;
}

export interface SecullumBatida {
  Id: number;
  FuncionarioId: number;
  Data: string;
  Entrada1: string | null;
  Saida1: string | null;
  Entrada2: string | null;
  Saida2: string | null;
  Entrada3: string | null;
  Saida3: string | null;
  Entrada4: string | null;
  Saida4: string | null;
  Entrada5: string | null;
  Saida5: string | null;
  Funcionario: {
    NumeroPis: string;
    NumeroFolha: string;
    NumeroIdentificador: string;
  };
  [key: string]: unknown;
}

export interface LatenessRecord {
  funcionarioId: number;
  nome: string;
  departamento: string;
  data: string;
  diaSemana: string;
  horarioEsperado: string;
  horarioReal: string;
  atrasado: boolean;
  minutosAtraso: number;
  horarioCompleto: string;
}

export interface AuthState {
  token: string;
  bankId: number;
  bankName: string;
}
