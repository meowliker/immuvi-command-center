import { CommandCenterShell } from "@/components/command-center/CommandCenterShell";

export default function CommandCenterPage() {
  return <CommandCenterShell useReactHeader={process.env.NEXT_PUBLIC_USE_REACT_SHELL === "1"} />;
}
