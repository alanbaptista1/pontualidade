---
name: employees-tracking
description: Sincroniza funcionários do banco quando link público é habilitado e rastreia status de email
type: feature
---
- Tabela `public_link_employees` com unique (owner_user_id, bank_id, numero_folha)
- Status enum `employee_email_status`: had_email | updated_via_link | no_email
- Edge function `sync-bank-employees` chamada ao salvar config do link público e via botão "Sincronizar agora"
- Sync preserva `original_email` e nunca rebaixa `updated_via_link` para outro status
- Approve-email-update marca o funcionário como `updated_via_link` na tabela após sucesso na Secullum
- Página `/funcionarios` lista por banco com filtros de status, busca, contadores e export CSV
