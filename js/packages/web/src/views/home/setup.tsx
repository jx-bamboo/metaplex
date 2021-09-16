import {
  useConnection,
  useStore,
  useWalletModal,
  WalletSigner,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { saveAdmin } from '../../actions/saveAdmin';
import { useMeta } from '../../contexts';
import { WhitelistedCreator } from '../../models/metaplex';
import { SetupVariables } from '../../components/SetupVariables';
import { WalletAdapter } from '@solana/wallet-adapter-base';

export const SetupView = () => {
  const [isInitalizingStore, setIsInitalizingStore] = useState(false);
  const connection = useConnection();
  const { store } = useMeta();
  const { setStoreForOwner } = useStore();
  const history = useHistory();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const connect = useCallback(
    () => (wallet.wallet ? wallet.connect().catch() : setVisible(true)),
    [wallet.wallet, wallet.connect, setVisible],
  );
  const [storeAddress, setStoreAddress] = useState<string | undefined>();

  useEffect(() => {
    const getStore = async () => {
      if (wallet.publicKey) {
        const store = await setStoreForOwner(wallet.publicKey.toBase58());
        setStoreAddress(store);
      } else {
        setStoreAddress(undefined);
      }
    };
    getStore();
  }, [wallet.publicKey]);

  const initializeStore = async () => {
    if (!wallet.publicKey) {
      return;
    }

    setIsInitalizingStore(true);

    await saveAdmin(connection, wallet, false, [
      new WhitelistedCreator({
        address: wallet.publicKey.toBase58(),
        activated: true,
      }),
    ]);

    // TODO: process errors

    await setStoreForOwner(undefined);
    await setStoreForOwner(wallet.publicKey.toBase58());

    history.push('/admin');
  };

  return (
    <>
      {!wallet.connected && (
        <p>
          <Button type="primary" className="app-btn" onClick={connect}>
            连接
          </Button>{' '}
          to 配置商店.
        </p>
      )}
      {wallet.connected && !store && (
        <>
          <p>商店尚未初始化</p>
          <p>初始化前钱包里一定有一些◎SOL。</p>
          <p>
          初始化完成后，您将能够管理创作者列表
          </p>

          <p>
            <Button
              className="app-btn"
              type="primary"
              loading={isInitalizingStore}
              onClick={initializeStore}
            >
              初始化商店
            </Button>
          </p>
        </>
      )}
      {wallet.connected && store && (
        <>
          <p>
          要完成初始化，请将下面的配置复制到{' '}
            <b>packages/web/.env</b> 并重启 yarn 或重新部署
          </p>
          <SetupVariables
            storeAddress={storeAddress}
            storeOwnerAddress={wallet.publicKey?.toBase58()}
          />
        </>
      )}
    </>
  );
};
