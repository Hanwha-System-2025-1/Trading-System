// import { useIsSignedIn } from "../../hooks/useIsSignedIn";
import hanwha from "../assets/hanwha.png";
import { logout } from "../utils/logout";
import Button from "@mui/joy/Button";
import LogoutIcon from "@mui/icons-material/Logout";

const Nav = () => {
  let { isSignedIn } = true

  return (
    <div className="w-full h-16 flex justify-between items-center bg-second rounded-full px-6">
    <div>
        <img src={hanwha} alt="hanwha logo" width={80} />
        <div>한화시스템</div>
    </div>
      {isSignedIn && <Button
      size="sm"
      variant="soft"
      color="neutral"
      startDecorator={LogoutIcon}
      onClick={logout}
      >로그아웃</Button>}
    </div>
  );
};

export default Nav;