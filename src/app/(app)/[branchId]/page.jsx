"use client";

import RoleCalendar from "@/components/Calendar/RoleCalendar";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  return (
    <div className="">
      <div className="">
        <RoleCalendar />
      </div>
    </div>
  );
}
