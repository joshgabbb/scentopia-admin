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
                        className="fixed inset-0 bg-black bg-opacity-40 z-20"
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
                        className="fixed top-0 right-0 w-full sm:w-[450px] h-full bg-[#1a1a1a] shadow-lg z-30 border-l flex flex-col dark:bg-black"
                    >
                        <div className="flex flex-col items-center justify-between p-4 border-b pt-10 pb-6">
                            <div className="flex flex-row w-full justify-between">
                                <h2 className="text-lg font-semibold">{title ?? "Sidebar"}</h2>
                                <button onClick={onClose}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {header ?? <></>}
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-4">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
