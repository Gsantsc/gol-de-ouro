import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import type { Match } from "../shared";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { useFootballData } from "../hooks/useFootballData";
import { BottomTabs, type MainTab } from "../components/BottomTabs";
import { InstallPwaPrompt } from "../components/InstallPwaPrompt";
import { AppViewport, ErrorState, ScreenScroll, Skeleton, ToastBanner } from "../components/ui";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ApprovalScreen } from "../screens/ApprovalScreen";
import { AuthScreen } from "../screens/AuthScreen";
import { GroupsScreen } from "../screens/GroupsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { InviteScreen } from "../screens/InviteScreen";
import { MatchDetailsScreen } from "../screens/MatchDetailsScreen";
import { PredictionScreen } from "../screens/PredictionScreen";
import { PredictionsScreen } from "../screens/PredictionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RankingScreen } from "../screens/RankingScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { TournamentsScreen } from "../screens/TournamentsScreen";
import { acceptAppInvite, acceptGroupInvite } from "../services/football.service";

type Overlay =
  | { type: "details"; match: Match }
  | { type: "prediction"; match: Match }
  | null;

type Toast = { message: string; tone: "success" | "error" | "warning" | "info" } | null;

const PENDING_INVITE_STORAGE_KEY = "gol-de-ouro.pendingInviteUrl";
const SAVED_INVITE_CODE_STORAGE_KEY = "gol-de-ouro.savedPendingInviteCode";

const readPathParts = (url: string) => {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return url.split(/[?#]/)[0].split("/").filter(Boolean);
  }
};

const isAppInviteUrl = (url: string) => readPathParts(url).join("/").includes("invite/app");

const extractGroupInviteCode = (url: string | null) => {
  if (!url || isAppInviteUrl(url)) return null;
  const parts = readPathParts(url);
  const inviteIndex = parts.indexOf("invite");
  if (inviteIndex >= 0) {
    const next = parts[inviteIndex + 1];
    if (next === "group") return parts[inviteIndex + 2] ?? null;
    return next ?? null;
  }

  const joinIndex = parts.indexOf("join");
  if (joinIndex >= 0 && parts[joinIndex + 1] === "group") return parts[joinIndex + 2] ?? null;
  return null;
};

const extractGroupRouteId = (url: string | null) => {
  if (!url) return null;
  const parts = readPathParts(url);
  const index = parts.findIndex((part) => part === "ligas" || part === "leagues" || part === "groups");
  return index >= 0 ? parts[index + 1] ?? null : null;
};

const AppContent = () => {
  const {
    loading: authLoading,
    profile,
    refreshProfile,
    refreshingProfile,
    session
  } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [pendingInviteUrl, setPendingInviteUrl] = useState<string | null>(null);
  const [savedPendingInviteCode, setSavedPendingInviteCode] = useState<string | null>(null);
  const [showAuthForInvite, setShowAuthForInvite] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const accessStatus = profile?.status ?? (profile?.blocked ? "suspended" : profile?.approval_status);
  const approvedUserId = accessStatus === "approved" && !profile?.blocked ? profile?.id : undefined;
  const {
    error: dataError,
    achievements,
    appInvites,
    groupMembers,
    groups,
    loading,
    matches,
    myRanking,
    notifications,
    players,
predictions,
ranking,
competitionRanking,
refresh,
settings,
tournaments
  } = useFootballData(approvedUserId);
  const predictionLockMinutes = settings.prediction_lock_minutes;

  const showToast = (message: string, tone: NonNullable<Toast>["tone"] = "info") => {
    setToast({ message, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const position = useMemo(() => {
    const index = ranking.findIndex((item) => item.user_id === profile?.id);
    return index >= 0 ? index + 1 : null;
  }, [profile?.id, ranking]);

  const persistPendingInviteUrl = useCallback(async (url: string | null) => {
    setPendingInviteUrl(url);
    if (url) {
      await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, url);
    } else {
      await AsyncStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      await AsyncStorage.removeItem(SAVED_INVITE_CODE_STORAGE_KEY);
    }
  }, []);

  const rememberUrl = useCallback((url: string | null) => {
    if (!url) return;

    if (url.includes("invite") || url.includes("join")) {
      persistPendingInviteUrl(url).catch(console.error);
      setShowAuthForInvite(false);
      return;
    }

    const routeGroupId = extractGroupRouteId(url);
    if (routeGroupId) {
      setSelectedGroupId(routeGroupId);
      setActiveTab("groups");
    }
  }, [persistPendingInviteUrl]);

  useEffect(() => {
    const restorePendingInvite = async () => {
      const storedInviteUrl = await AsyncStorage.getItem(PENDING_INVITE_STORAGE_KEY);
      const storedSavedCode = await AsyncStorage.getItem(SAVED_INVITE_CODE_STORAGE_KEY);
      if (storedInviteUrl) setPendingInviteUrl(storedInviteUrl);
      if (storedSavedCode) setSavedPendingInviteCode(storedSavedCode);
    };

    restorePendingInvite().catch(console.error);
    Linking.getInitialURL().then(rememberUrl).catch(console.error);
    const subscription = Linking.addEventListener("url", (event) => {
      rememberUrl(event.url);
    });

    return () => subscription.remove();
  }, [rememberUrl]);

  useEffect(() => {
    if (!profile || accessStatus !== "approved" || profile.blocked || !pendingInviteUrl || !isAppInviteUrl(pendingInviteUrl)) return;

    const handleAppInviteUrl = async (url: string | null) => {
      if (!url || !isAppInviteUrl(url)) return;
      const invite = url.split("/").filter(Boolean).pop();
      if (!invite) return;

      try {
        await acceptAppInvite(invite);
        await persistPendingInviteUrl(null);
        setActiveTab("home");
        showToast("Convite do app confirmado.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Convite invalido. Tente novamente.", "error");
      }
    };

    handleAppInviteUrl(pendingInviteUrl).catch(console.error);
  }, [accessStatus, pendingInviteUrl, persistPendingInviteUrl, profile]);

  const groupInviteCode = extractGroupInviteCode(pendingInviteUrl);

  const handleGroupInviteAccept = useCallback(async () => {
    if (!groupInviteCode) return null;

    try {
      setAcceptingInvite(true);
      const result = await acceptGroupInvite(groupInviteCode);
      if (result?.status === "pending_approval") {
        setSavedPendingInviteCode(groupInviteCode);
        await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, pendingInviteUrl ?? groupInviteCode);
        await AsyncStorage.setItem(SAVED_INVITE_CODE_STORAGE_KEY, groupInviteCode);
        return result;
      }

      await refresh();
      await persistPendingInviteUrl(null);
      await AsyncStorage.removeItem(SAVED_INVITE_CODE_STORAGE_KEY);
      setSavedPendingInviteCode(null);
      setSelectedGroupId(result?.group_id ?? null);
      setActiveTab("groups");
      showToast(
        result?.status === "already_member" ? "Voce ja participa desta liga." : "Convite aceito. Voce entrou na liga.",
        "success"
      );
      return result;
    } finally {
      setAcceptingInvite(false);
    }
  }, [groupInviteCode, pendingInviteUrl, persistPendingInviteUrl, refresh]);

  useEffect(() => {
    if (accessStatus !== "approved" || !groupInviteCode || savedPendingInviteCode !== groupInviteCode) return;

    handleGroupInviteAccept().catch((error) => {
      showToast(error instanceof Error ? error.message : "Convite invalido. Tente novamente.", "error");
    });
  }, [accessStatus, groupInviteCode, handleGroupInviteAccept, savedPendingInviteCode]);

  if (authLoading) return <SplashScreen />;
  if (!session) {
    if (groupInviteCode && !showAuthForInvite) {
      return (
        <InviteScreen
          accepting={acceptingInvite}
          accessStatus="signed_out"
          inviteCode={groupInviteCode}
          onAccept={handleGroupInviteAccept}
          onRequireAuth={() => setShowAuthForInvite(true)}
        />
      );
    }

    return <AuthScreen />;
  }
  if (!profile) return <SplashScreen />;

  if (groupInviteCode && accessStatus !== "approved" && !profile.blocked) {
    return (
      <InviteScreen
        accepting={acceptingInvite}
        accessStatus={accessStatus === "pending" ? "pending" : "rejected"}
        inviteCode={groupInviteCode}
        onAccept={handleGroupInviteAccept}
        onRequireAuth={() => setShowAuthForInvite(true)}
        onVerifyApproval={refreshProfile}
        refreshingProfile={refreshingProfile}
      />
    );
  }

  if (groupInviteCode && profile.blocked) {
    return (
      <InviteScreen
        accepting={acceptingInvite}
        accessStatus="suspended"
        inviteCode={groupInviteCode}
        onAccept={handleGroupInviteAccept}
        onRequireAuth={() => setShowAuthForInvite(true)}
      />
    );
  }

  if (groupInviteCode && accessStatus === "approved" && !profile.blocked) {
    return (
      <InviteScreen
        accepting={acceptingInvite}
        accessStatus="approved"
        inviteCode={groupInviteCode}
        onAccept={handleGroupInviteAccept}
        onRequireAuth={() => setShowAuthForInvite(true)}
      />
    );
  }

  if (accessStatus !== "approved" || profile.blocked) {
    return <ApprovalScreen />;
  }

  if (overlay?.type === "prediction") {
    const prediction = predictions.find((item) => item.match_id === overlay.match.id);
    return (
      <PredictionScreen
        match={overlay.match}
        onClose={() => setOverlay(null)}
        onSubmitted={refresh}
        players={players}
        predictionLockMinutes={predictionLockMinutes}
        prediction={prediction}
      />
    );
  }

  if (overlay?.type === "details") {
    const prediction = predictions.find((item) => item.match_id === overlay.match.id);
    return (
      <MatchDetailsScreen
        match={overlay.match}
        myPrediction={prediction}
        onBack={() => setOverlay(null)}
        onPredict={() => setOverlay({ type: "prediction", match: overlay.match })}
      />
    );
  }

  const openDetails = (match: Match) => setOverlay({ type: "details", match });
  const openPrediction = (match: Match) => setOverlay({ type: "prediction", match });

  return (
    <ErrorBoundary
      debugContext={{
        activeTab,
        matchesCount: matches.length,
        playersCount: players.length,
        predictionsCount: predictions.length
      }}
    >
      <AppViewport
        footer={<BottomTabs activeTab={activeTab} onChange={setActiveTab} />}
        toast={toast ? <ToastBanner message={toast.message} tone={toast.tone} /> : null}
      >
        <InstallPwaPrompt />
        {loading ? (
        <ScreenScroll>
          <Skeleton count={6} height={92} />
        </ScreenScroll>
      ) : dataError ? (
        <ScreenScroll>
          <ErrorState body={dataError} onRetry={refresh} />
        </ScreenScroll>
      ) : activeTab === "home" ? (
        <HomeScreen
          groups={groups}
          appInvites={appInvites}
          matches={matches}
          onDetails={openDetails}
          onEditProfile={() => setActiveTab("profile")}
          onPredict={openPrediction}
          onRefresh={refresh}
          onToast={showToast}
          onViewGames={() => setActiveTab("games")}
          onViewGroups={() => setActiveTab("groups")}
          onViewPredictions={() => setActiveTab("predictions")}
          notifications={notifications}
          position={position}
          predictionLockMinutes={predictionLockMinutes}
          predictions={predictions}
          profile={profile}
          ranking={myRanking}
          tournaments={tournaments}
        />
      ) : activeTab === "games" ? (
        <TournamentsScreen
          matches={matches}
          onDetails={openDetails}
          onPredict={openPrediction}
          predictionLockMinutes={predictionLockMinutes}
          predictions={predictions}
          tournaments={tournaments}
        />
      ) : activeTab === "predictions" ? (
        <PredictionsScreen
  matches={matches}
  onViewGames={() => setActiveTab("games")}
  players={players}
  predictionLockMinutes={predictionLockMinutes}
  predictions={predictions}
  ranking={myRanking}
/>
      ) : activeTab === "ranking" ? (
        <RankingScreen
          groups={groups}
          members={groupMembers}
          ranking={ranking}
          userId={profile.id}
        />
      ) : activeTab === "groups" ? (
        <ScreenScroll>
          <GroupsScreen
            groups={groups}
            initialSelectedGroupId={selectedGroupId}
            members={groupMembers}
            onRefresh={refresh}
            onSelectGroup={setSelectedGroupId}
            rankings={ranking}
            tournaments={tournaments}
            userId={profile.id}
          />
        </ScreenScroll>
      ) : (
        <ProfileScreen
          achievements={achievements}
          matches={matches}
          position={position}
          predictions={predictions}
          ranking={myRanking}
        />
      )}
      </AppViewport>
    </ErrorBoundary>
  );
};

export default function AppRoot() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
