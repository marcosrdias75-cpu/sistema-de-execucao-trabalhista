export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md border border-[#c7ccbf] bg-white px-3 text-sm font-medium text-[#293127] shadow-sm"
      >
        Sair
      </button>
    </form>
  );
}
