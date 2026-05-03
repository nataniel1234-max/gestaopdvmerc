import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/caixa")({
  beforeLoad: () => {
    throw redirect({ to: "/pdv" });
  },
});
