"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface CustomSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    header?: ReactNode;
}

export default function CustomSidebar({ isOpen, onClose, children, title, header }: CustomSidebarProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/25 backdrop-blur-sm z-20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Sidebar panel */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ duration: 0.3 }}
                        className="fixed top-0 right-0 w-full sm:w-[480px] h-full bg-white shadow-2xl shadow-black/10 z-30 border-l border-[#e8e0d0] flex flex-col"
                    >
                        <div className="flex flex-col items-center justify-between px-6 pt-8 pb-5 border-b border-[#e8e0d0] bg-[#faf8f3]">
                            <div className="flex flex-row w-full justify-between items-center">
                                <h2 className="text-base font-bold text-[#1c1810] tracking-wide uppercase">{title ?? "Sidebar"}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-[#9a8a6a] hover:text-[#1c1810] hover:bg-[#f0ebe0] rounded-sm transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {header ?? <></>}
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
