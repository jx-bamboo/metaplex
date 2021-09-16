import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { MintLayout, AccountLayout } from '@solana/spl-token';
import { Button, Form, Input, Modal, InputNumber } from 'antd';
import debounce from 'lodash/debounce';
import {
  decodeMasterEdition,
  MAX_EDITION_LEN,
  MAX_METADATA_LEN,
  MetadataKey,
  MetaplexOverlay,
  useConnection,
  useUserAccounts,
} from '@oyster/common';
import { useArt } from '../../hooks';
import { mintEditionsToWallet } from '../../actions/mintEditionsIntoWallet';
import { ArtType } from '../../types';
import { Confetti } from '../Confetti';
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

interface ArtMintingProps {
  id: string;
  onMint: Function;
}

export const ArtMinting = ({ id, onMint }: ArtMintingProps) => {
  const wallet = useWallet();
  const connection = useConnection();
  const { accountByMint } = useUserAccounts();
  const [showMintModal, setShowMintModal] = useState<boolean>(false);
  const [showCongrats, setShowCongrats] = useState<boolean>(false);
  const [mintingDestination, setMintingDestination] = useState<string>('');
  const [editions, setEditions] = useState<number>(1);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const art = useArt(id);

  const walletPubKey = wallet?.publicKey?.toString() || '';
  const maxEditionsToMint = art.maxSupply! - art.supply!;
  const isArtMasterEdition = art.type === ArtType.Master;
  const artMintTokenAccount = accountByMint.get(art.mint!);
  const isArtOwnedByUser =
    ((accountByMint.has(art.mint!) &&
      artMintTokenAccount?.info.amount.toNumber()) ||
      0) > 0;
  const isMasterEditionV1 = artMintTokenAccount
    ? decodeMasterEdition(artMintTokenAccount.account.data).key ===
      MetadataKey.MasterEditionV1
    : false;
  const renderMintEdition =
    isArtMasterEdition &&
    isArtOwnedByUser &&
    !isMasterEditionV1 &&
    maxEditionsToMint !== 0;

  const mintingDestinationErr = useMemo(() => {
    if (!mintingDestination) return 'Required';

    try {
      new PublicKey(mintingDestination);
      return '';
    } catch (e) {
      return '無效的地址格式';
    }
  }, [mintingDestination]);

  const isMintingDisabled =
    isLoading || editions < 1 || Boolean(mintingDestinationErr);

  const debouncedEditionsChangeHandler = useCallback(
    debounce(val => {
      setEditions(val < 1 ? 1 : val);
    }, 300),
    [],
  );

  useEffect(() => {
    if (editions < 1) return;

    (async () => {
      const mintRentExempt = await connection.getMinimumBalanceForRentExemption(
        MintLayout.span,
      );
      const accountRentExempt =
        await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
      const metadataRentExempt =
        await connection.getMinimumBalanceForRentExemption(MAX_METADATA_LEN);
      const editionRentExempt =
        await connection.getMinimumBalanceForRentExemption(MAX_EDITION_LEN);

      const cost =
        ((mintRentExempt +
          accountRentExempt +
          metadataRentExempt +
          editionRentExempt) *
          editions) /
        LAMPORTS_PER_SOL;

      setTotalCost(cost);
    })();
  }, [connection, editions]);

  useEffect(() => {
    if (!walletPubKey) return;

    setMintingDestination(walletPubKey);
  }, [walletPubKey]);

  useEffect(() => {
    return debouncedEditionsChangeHandler.cancel();
  }, []);

  const onSuccessfulMint = () => {
    setShowMintModal(false);
    setMintingDestination(walletPubKey);
    setEditions(1);
    setShowCongrats(true);
  };

  const mint = async () => {
    try {
      setIsLoading(true);
      await mintEditionsToWallet(
        art,
        wallet!,
        connection,
        artMintTokenAccount!,
        editions,
        mintingDestination,
      );
      onSuccessfulMint();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {renderMintEdition && (
        <div>
          <Button
            type="primary"
            size="large"
            className="action-btn"
            style={{ marginTop: 20 }}
            onClick={() => setShowMintModal(true)}
          >
            铸造
          </Button>

          <Modal
            visible={showMintModal}
            centered
            okText="Mint"
            closable={!isLoading}
            okButtonProps={{
              disabled: isMintingDisabled,
            }}
            cancelButtonProps={{ disabled: isLoading }}
            onOk={mint}
            onCancel={() => setShowMintModal(false)}
          >
            <Form.Item
              style={{
                width: '100%',
                flexDirection: 'column',
                paddingTop: 30,
                marginBottom: 4,
              }}
              label={<h3>铸造到</h3>}
              labelAlign="left"
              colon={false}
              validateStatus={mintingDestinationErr ? 'error' : 'success'}
              help={mintingDestinationErr}
            >
              <Input
                placeholder="Address to mint edition to"
                value={mintingDestination}
                onChange={e => {
                  setMintingDestination(e.target.value);
                }}
              />
            </Form.Item>

            <Form.Item
              style={{
                width: '100%',
                flexDirection: 'column',
                paddingTop: 30,
              }}
              label={<h3>要铸造的版本数</h3>}
              labelAlign="left"
              colon={false}
            >
              <InputNumber
                type="number"
                placeholder="1"
                style={{ width: '100%' }}
                min={1}
                max={maxEditionsToMint}
                value={editions}
                precision={0}
                onChange={debouncedEditionsChangeHandler}
              />
            </Form.Item>

            <div>总成本: {`◎${totalCost}`}</div>
          </Modal>

          <MetaplexOverlay visible={showCongrats}>
            <Confetti />
            <h1
              className="title"
              style={{
                fontSize: '3rem',
                marginBottom: 20,
              }}
            >
              恭喜你
            </h1>
            <p
              style={{
                color: 'white',
                textAlign: 'center',
                fontSize: '2rem',
              }}
            >
              新的NFT已经铸造完成，请在此查看{' '}
              <Link to="/artworks">我的NFT</Link>.
            </p>
            <Button
              onClick={async () => {
                await onMint();
                setShowCongrats(false);
              }}
              className="overlay-btn"
            >
              我知道了
            </Button>
          </MetaplexOverlay>
        </div>
      )}
    </>
  );
};
