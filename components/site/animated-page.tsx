"use client";

import { motion } from "framer-motion";

type AnimatedPageProps = {
  children: React.ReactNode;
};

export function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="min-h-[70vh]"
    >
      {children}
    </motion.div>
  );
}
