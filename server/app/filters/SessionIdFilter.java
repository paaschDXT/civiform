package filters;

import static play.mvc.Results.redirect;

import akka.stream.Materializer;
import com.google.common.collect.ImmutableSet;
import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import play.mvc.Filter;
import play.mvc.Http;
import play.mvc.Result;
import services.settings.SettingsManifest;

/** Filter that ensures all sessions have have a unique ID. */
public final class SessionIdFilter extends Filter {
  public static final String SESSION_ID = "sessionId";

  private static final ImmutableSet<String> excludedPrefixes =
      ImmutableSet.of("/api/", "/assets/", "/dev/", "/favicon");

  private final Provider<SettingsManifest> settingsManifestProvider;

  @Inject
  public SessionIdFilter(Materializer mat, Provider<SettingsManifest> settingsManifestProvider) {
    super(mat);
    this.settingsManifestProvider = settingsManifestProvider;
  }

  private boolean shouldApplyThisFilter(Http.RequestHeader requestHeader) {
    return settingsManifestProvider.get().getEnhancedOidcLogoutEnabled()
        && excludedPrefixes.stream().noneMatch(prefix -> requestHeader.uri().startsWith(prefix))
        // Since we are using redirects, we only apply this filter for a GET request.
        && requestHeader.method().equals("GET")
        && requestHeader.session().get(SESSION_ID).isEmpty();
  }

  @Override
  public CompletionStage<Result> apply(
      Function<Http.RequestHeader, CompletionStage<Result>> nextFilter,
      Http.RequestHeader requestHeader) {
    if (!shouldApplyThisFilter(requestHeader)) {
      return nextFilter.apply(requestHeader);
    }

    // Mint and store a new session id.
    //
    // Since the Play session is immutable for a request, we must redirect in order to get Play to
    // pick up the new value.
    String sessionId = UUID.randomUUID().toString();
    return CompletableFuture.completedFuture(
        redirect(requestHeader.uri())
            .withSession(requestHeader.session().adding(SESSION_ID, sessionId)));
  }
}