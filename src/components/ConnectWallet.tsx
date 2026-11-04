import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { getAddress } from "viem";
import { sepolia } from "wagmi/chains";
import { OPEN_IN } from "../lib/wallet";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export function ConnectWallet({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, variables, error, reset } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const mobile =
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 &&
        matchMedia("(pointer: coarse)").matches)) &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const list = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK" && mobile
        ? "Coinbase Smart Wallet"
        : c.name;
  const doOpen = () => {
    onOpen();
    setOpen(true);
    setNote("");
    reset();
  };
  const triggerLabel =
    isConnected && chainId !== sepolia.id
      ? "Switch to Sepolia"
      : address
        ? short(getAddress(address))
        : "Connect wallet";
  return (
    <>
      <button
        className="wallet-button"
        onClick={() => {
          if (isConnected && chainId !== sepolia.id) {
            switchChain(
              { chainId: sepolia.id },
              {
                onError: () => {
                  doOpen();
                  setNote(
                    "Network switch declined. Reopen your wallet and try again.",
                  );
                },
              },
            );
          } else doOpen();
        }}
      >
        <Icon name="wallet" size={16} />
        <span>{switching ? "Switching…" : triggerLabel}</span>
      </button>
      {open && (
        <Modal
          title={isConnected ? "Wallet connected" : "Connect a wallet"}
          close={() => setOpen(false)}
        >
          <p className="muted">
            Optional for play. Read Squeekchain account and NFT data on Sepolia
            testnet.
          </p>
          {isConnected && address ? (
            <>
              <p className="full-address">{getAddress(address)}</p>
              <button
                className="secondary full"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
              >
                Disconnect wallet
              </button>
            </>
          ) : (
            <div className="wallet-list">
              {mobile &&
                OPEN_IN.map((w) => (
                  <a key={w.id} href={w.href(location.href)}>
                    <img
                      src={`${import.meta.env.BASE_URL}assets/wallet-${w.id}.svg`}
                      alt=""
                      width="28"
                      height="28"
                    />
                    <span>Open in {w.name}</span>
                    <Icon name="external" size={16} />
                  </a>
                ))}
              {list.map((c) => (
                <button
                  key={c.uid}
                  disabled={isPending}
                  onClick={async () => {
                    reset();
                    setNote("");
                    if (c.id === "injected" && !(await c.getProvider())) {
                      setNote(
                        "No browser wallet found. Install a wallet extension or open this page in your wallet app.",
                      );
                      return;
                    }
                    connect({ connector: c });
                  }}
                >
                  <img
                    src={
                      c.icon ??
                      `${import.meta.env.BASE_URL}assets/wallet-${c.id === "coinbaseWalletSDK" ? "coinbase" : c.id === "walletConnect" ? "walletconnect" : "browser"}.svg`
                    }
                    alt=""
                    width="28"
                    height="28"
                  />
                  <span>
                    {label(c)}
                    {isPending && variables?.connector === c
                      ? " · opening…"
                      : ""}
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>
          )}
          <p className="small muted">
            This arcade never requests token approvals or transfers.
          </p>
          <p role="status" className="wallet-error">
            {note ||
              (error
                ? "Connection declined or unavailable. Try again in your wallet."
                : "")}
          </p>
        </Modal>
      )}
    </>
  );
}
