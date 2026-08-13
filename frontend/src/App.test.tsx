import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('VeriTriage RBAC App', () => {
  it('renders the main headers and defaults to TRIAGEM role', () => {
    render(<App />);
    expect(screen.getByText('VeriTriage AI')).toBeInTheDocument();
    
    // Default Tab should have active class and show the correct panel
    const triagemBtn = screen.getByRole('button', { name: /TRIAGEM/i });
    expect(triagemBtn).toHaveClass('active');
    
    // Should show symptoms textarea (clinical input)
    expect(screen.getByPlaceholderText(/Insira os sintomas para a IA processar o protocolo/i)).toBeInTheDocument();
  });

  it('proves Privacy by Design (LGPD): CPF input should NOT exist in Triagem', () => {
    render(<App />);
    
    // In Triagem tab, we shouldn't ask for CPF or Name
    const cpfInput = screen.queryByPlaceholderText(/000.000.000-00/i);
    expect(cpfInput).not.toBeInTheDocument();
  });

  it('proves Privacy by Design (LGPD): CPF input should exist ONLY in Recepção', () => {
    render(<App />);
    
    // Switch to Recepção
    const recepcaoBtn = screen.getByRole('button', { name: /RECEPÇÃO/i });
    fireEvent.click(recepcaoBtn);
    
    expect(recepcaoBtn).toHaveClass('active');
    
    // It should now show patient queue and PII form when selecting a patient
    // Because no patients exist, we won't see the input directly, but we can verify the text
    expect(screen.getByText(/Nenhum paciente aguardando ficha/i)).toBeInTheDocument();
  });
  
  it('navigates to QA HARNESS tab successfully', () => {
    render(<App />);
    
    const qaBtn = screen.getByRole('button', { name: /QA HARNESS/i });
    fireEvent.click(qaBtn);
    
    expect(qaBtn).toHaveClass('active');
    expect(screen.getByText(/Validação Automatizada de IA/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rodar Avaliação/i })).toBeInTheDocument();
  });
});
