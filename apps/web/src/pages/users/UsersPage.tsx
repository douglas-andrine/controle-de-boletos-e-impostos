import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import type { UserDTO } from "@tributoleao/shared";
import { useUsers } from "../../lib/users";
import { Button } from "../../components/ui/Button";
import { UserFormDialog } from "./UserFormDialog";

const formatCreatedAt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function RoleBadge({ user }: { user: UserDTO }) {
  if (user.role !== "ADMIN") return <span className="text-sm text-slate-500">Usuário</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-heading">
      <ShieldCheck className="size-3.5" aria-hidden />
      Admin
    </span>
  );
}

export function UsersPage() {
  const { data: users, isPending, isError, refetch } = useUsers();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Usuários</h1>
          <p className="mt-1 text-sm text-slate-500">Quem tem acesso ao sistema. Cada usuário vê só os próprios dados.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novo usuário
        </Button>
      </div>

      {isError && !users ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-card p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar os usuários.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-48 animate-pulse rounded-lg border border-slate-200 bg-card" aria-hidden />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Acesso</th>
                <th className="hidden px-4 py-3 sm:table-cell">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                  <td className="px-4 py-3 break-all text-slate-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge user={user} />
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 tabular-nums sm:table-cell">{formatCreatedAt(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
