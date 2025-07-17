import hanwha from "./../assets/hanwha.png";

const NotFound = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center">
      <img src={hanwha} alt="logo_yellow" width={200} className="mb-4" />
      <h2 className="mb-4 text-lg font-bold text-slate-800">
        서비스 이용에 불편을 드려 죄송합니다.
      </h2>
      <p className="text-sm text-slate-600">
        요청하신 페이지가 존재하지 않거나 오류가 발생했습니다.
      </p>
      <p className="mb-4 text-sm text-slate-600">
        잠시 후에 다시 접속을 시도해 주십시오.
      </p>
      <a href="/" className="inline-block">
        <button className="bg-blue-400 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded shadow">
          홈으로
        </button>
      </a>
    </div>
  );
};

export default NotFound;
