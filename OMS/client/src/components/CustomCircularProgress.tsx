import React from "react";
import { CircularProgress } from "@mui/material"; // Material UI 사용
import { motion } from "framer-motion"; // 애니메이션 추가

interface ICustomCircularProgress {
  size?: "sm" | "md" | "lg";
}

/** 📌 개선된 로딩 중 화면 */
const CustomCircularProgress: React.FC<ICustomCircularProgress> = ({ size = "lg" }) => {
  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-black/30 backdrop-blur-sm absolute top-0 left-0">
      {/* 로딩 애니메이션 */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <CircularProgress color="primary" size={size} />
      </motion.div>

      {/* 로딩 메시지 (더 크고 굵게) */}
      <motion.p
        className="mt-4 text-white text-3xl font-bold animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
      >
        📈 종목을 불러오고 있습니다.
        <br /><br/>
        잠시만 기다려 주세요.
      </motion.p>
    </div>
  );
};

export default CustomCircularProgress;
