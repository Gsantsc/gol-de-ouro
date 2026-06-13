import { useEffect, useMemo, useState } from "react";
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
import { MatchDetailsScreen } from "../screens/MatchDetailsScreen";
import { PredictionScreen } from "../screens/PredictionScreen";
import { PredictionsScreen } from "../screens/PredictionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RankingScreen } from "../screens/RankingScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { TournamentsScreen } from "../screens/TournamentsScreen";
import { acceptAppInvite, joinGroupByInvite } from "../services/football.service";

type Overlay =
  | { type: "details"; match: Match }
  | { type: "prediction"; match: Match }
  | null;

type Toast = { message: string; tone: "success" | "error" | "warning" | "info" } | null;

const AppContent = () => {
  const { loading: authLoading, profile, session } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [pendingInviteUrl, setPendingInviteUrl] = useState<string | null>(null);
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
    refresh,
    tournaments
  } =
    useFootballData(approvedUserId);

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
  useEffect(() => {
    const rememberInviteUrl = (url: string | null) => {
      if (url && (url.includes("invite") || url.includes("join"))) setPendingInviteUrl(url);
    };

    Linking.getInitialURL().then(rememberInviteUrl).catch(console.error);
    const subscription = Linking.addEventListener("url", (event) => {
      rememberInviteUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!profile || accessStatus !== "approved" || profile.blocked || !pendingInviteUrl) return;

    const handleInviteUrl = async (url: string | null) => {
      if (!url || (!url.includes("invite") && !url.includes("join"))) return;
      const invite = url.split("/").filter(Boolean).pop();
      if (!invite) return;

      try {
        if (url.includes("/invite/app/")) {
          await acceptAppInvite(invite);
          setPendingInviteUrl(null);
          showToast("Convite do app confirmado.", "success");
          return;
        }

        await joinGroupByInvite(invite);
        await refresh();
        setActiveTab("home");
        setPendingInviteUrl(null);
        showToast("Convite aceito. Você entrou na liga.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Convite inválido. Tente novamente.", "error");
      }
    };

    handleInviteUrl(pendingInviteUrl).catch(console.error);
  }, [accessStatus, pendingInviteUrl, profile, refresh]);

  if (authLoading) return <SplashScreen />;
  if (!session) return <AuthScreen />;
  if (!profile) return <SplashScreen />;
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
          predictions={predictions}
          tournaments={tournaments}
        />
      ) : activeTab === "predictions" ? (
        <PredictionsScreen matches={matches} players={players} predictions={predictions} ranking={myRanking} />
      ) : activeTab === "ranking" ? (
        <RankingScreen groups={groups} members={groupMembers} ranking={ranking} userId={profile.id} />
      ) : activeTab === "groups" ? (
        <ScreenScroll>
          <GroupsScreen
            groups={groups}
            members={groupMembers}
            onRefresh={refresh}
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
