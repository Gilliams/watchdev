// Kata Decorator — taux de change avec cache, logs et retry
const php = String.raw

export default {
  id: 'decorator',
  name: 'Decorator',
  nameFr: 'Décorateur',
  family: 'Structurel',
  guru: 'https://refactoring.guru/fr/design-patterns/decorator',
  summary: 'Cache, logs, retry greffés à coups de booléens dans le code métier.',

  problem:
    "Une classe accumule des préoccupations annexes (cache, logs, nouvelles tentatives) activées par des booléens dans son constructeur. Chaque option double les combinaisons à tester, et la logique métier se noie dans la tuyauterie.",

  kid:
    "Une boule de glace à la vanille. Tu peux ajouter du chocolat, puis de la chantilly, puis des vermicelles. Ça reste une glace : chaque garniture se pose par-dessus sans changer la boule d'en dessous, et c'est toi qui choisis l'ordre (la chantilly sous le chocolat, ce n'est pas pareil).",

  technical:
    "Decorator enveloppe un objet dans un autre qui implémente **la même interface**. Le décorateur reçoit l'objet « intérieur » dans son constructeur, ajoute son comportement avant ou après l'appel, et lui délègue le reste. Comme l'enveloppe a le même type que ce qu'elle contient, l'appelant ne voit pas la différence et on empile les couches dans l'ordre voulu.",

  example: {
    intro: "En préproduction, tous les mails doivent partir vers l'équipe QA. Plutôt qu'un `if (env === 'preprod')` dans le mailer, on l'enveloppe.",
    code: php`interface Mailer
{
    public function send(string $to, string $subject, string $body): void;
}

final class SmtpMailer implements Mailer
{
    public function send(string $to, string $subject, string $body): void
    {
        // envoi réel
    }
}

final class RedirectingMailer implements Mailer
{
    public function __construct(private Mailer $inner, private string $redirectTo) {}

    public function send(string $to, string $subject, string $body): void
    {
        $this->inner->send($this->redirectTo, "[pour $to] $subject", $body);
    }
}

// En préprod, et seulement là :
$mailer = new RedirectingMailer(new SmtpMailer(), 'qa@exemple.fr');`,
  },

  symfony: {
    text: "Le HttpClient en est truffé : `RetryableHttpClient`, `CachingHttpClient`, `ScopingHttpClient` enveloppent tous un `HttpClientInterface`. En dev, le profiler décore l'EventDispatcher pour tracer les événements. Pour décorer ton propre service sans toucher à la config des autres :",
    code: php`#[AsDecorator(decorates: RateProvider::class)]
final class CachedRateProvider implements RateProvider
{
    public function __construct(
        #[AutowireDecorated] private RateProvider $inner,
    ) {}
}`,
  },

  avoid: [
    "Une interface avec quinze méthodes : chaque décorateur doit toutes les déléguer. Le code devient du copier-coller, signe qu'il faut une interface plus fine.",
    "Quand l'ordre des couches est critique et mal compris (le cache avant ou après le log ?), l'empilement devient un piège : documente-le ou centralise la composition.",
    "Pour un comportement qui fait partie du métier lui-même (un calcul de TVA), ce n'est pas une couche : il appartient à la classe.",
  ],

  steps: [
    {
      title: 'Refactoriser',
      kind: 'Refacto',
      brief:
        "`EcbRateProvider` récupère des taux de change. Au fil des demandes, on lui a greffé un cache et des logs via des options de constructeur. Rends-lui son seul métier (donner un taux) et transforme le cache et les logs en **décorateurs** empilables.",
      contract: [
        "Interface `RateProvider` avec `rate(string $from, string $to): float`",
        "`EcbRateProvider` : constructeur sans paramètre, garde le compteur public `$calls`, plus de cache ni de log",
        "`CachedRateProvider(RateProvider $inner)` : n'interroge l'intérieur qu'une fois par paire",
        "`LoggedRateProvider(RateProvider $inner, Logbook $logbook)` : ajoute `\"EUR/USD = 1.08\"` à chaque appel",
        '`Logbook` est fourni, ne le modifie pas',
      ],
      starter: php`<?php
declare(strict_types=1);

// Journal fourni (ne pas modifier) : garde les lignes en mémoire
final class Logbook
{
    /** @var list<string> */
    public array $lines = [];

    public function add(string $line): void
    {
        $this->lines[] = $line;
    }
}

// Taux de change de la BCE (appel HTTP simulé).
// On lui a greffé un cache et des logs… à coups d'options.
final class EcbRateProvider
{
    private const RATES = ['EUR/USD' => 1.08, 'EUR/GBP' => 0.85, 'EUR/JPY' => 162.0];

    /** Nombre d'appels « réseau » réellement effectués */
    public int $calls = 0;

    /** @var array<string, float> */
    private array $cache = [];

    public function __construct(
        private bool $useCache = false,
        private ?Logbook $logbook = null,
    ) {
    }

    public function rate(string $from, string $to): float
    {
        $pair = "$from/$to";

        if ($this->useCache && isset($this->cache[$pair])) {
            $rate = $this->cache[$pair];
        } else {
            $this->calls++; // appel HTTP simulé
            $rate = self::RATES[$pair] ?? throw new InvalidArgumentException("Paire inconnue : $pair");
            if ($this->useCache) {
                $this->cache[$pair] = $rate;
            }
        }

        $this->logbook?->add("$pair = $rate");

        return $rate;
    }
}

// --- Bac à sable : exécuté par « Exécuter », ignoré pendant la validation ---
if (!defined('KATA_TESTING')) {
    $logbook = new Logbook();
    $ecb = new EcbRateProvider(useCache: true, logbook: $logbook);
    $ecb->rate('EUR', 'USD');
    $ecb->rate('EUR', 'USD');
    echo "Appels réseau : {$ecb->calls}", PHP_EOL;
    echo implode(PHP_EOL, $logbook->lines), PHP_EOL;
}
`,
      tests: [
        {
          label: 'Le contrat existe',
          code: php`return Expect::all(
    Expect::that(interface_exists('RateProvider'), 'RateProvider doit être une interface'),
    Expect::implements('EcbRateProvider', 'RateProvider'),
    Expect::implements('CachedRateProvider', 'RateProvider'),
    Expect::implements('LoggedRateProvider', 'RateProvider'),
);`,
        },
        {
          label: "EcbRateProvider ne fait plus qu'une chose",
          code: php`$ecb = new EcbRateProvider();
$ecb->rate('EUR', 'USD');
$second = $ecb->rate('EUR', 'USD');
return Expect::all(
    Expect::same([], Expect::constructorTypes('EcbRateProvider'), 'Paramètres du constructeur de EcbRateProvider'),
    Expect::near(1.08, $second, 'EUR/USD'),
    Expect::same(2, $ecb->calls, 'Appels réseau sans cache'),
    Expect::throws(InvalidArgumentException::class, fn () => $ecb->rate('EUR', 'XYZ'), 'Paire EUR/XYZ'),
);`,
        },
        {
          label: 'Le cache évite les appels répétés',
          code: php`$ecb = new EcbRateProvider();
$cached = new CachedRateProvider($ecb);
$cached->rate('EUR', 'USD');
$cached->rate('EUR', 'USD');
$rate = $cached->rate('EUR', 'USD');
$cached->rate('EUR', 'GBP');
return Expect::all(
    Expect::near(1.08, $rate, 'EUR/USD via le cache'),
    Expect::same(2, $ecb->calls, 'Appels réseau (3× EUR/USD + 1× EUR/GBP)'),
);`,
        },
        {
          label: 'Les logs tracent chaque appel',
          code: php`$log = new Logbook();
$logged = new LoggedRateProvider(new EcbRateProvider(), $log);
$logged->rate('EUR', 'USD');
$logged->rate('EUR', 'GBP');
return Expect::same(['EUR/USD = 1.08', 'EUR/GBP = 0.85'], $log->lines, 'Lignes du journal');`,
        },
        {
          label: 'Les décorateurs s’empilent : log, puis cache',
          code: php`$ecb = new EcbRateProvider();
$log = new Logbook();
$stack = new LoggedRateProvider(new CachedRateProvider($ecb), $log);
foreach ([1, 2, 3] as $_) { $stack->rate('EUR', 'USD'); }
return Expect::all(
    Expect::same(1, $ecb->calls, 'Appels réseau'),
    Expect::same(3, count($log->lines), 'Lignes de log (le log est à l’extérieur du cache)'),
);`,
        },
        {
          label: 'L’ordre compte : cache, puis log',
          code: php`$ecb = new EcbRateProvider();
$log = new Logbook();
$stack = new CachedRateProvider(new LoggedRateProvider($ecb, $log));
foreach ([1, 2, 3] as $_) { $stack->rate('EUR', 'USD'); }
return Expect::same(1, count($log->lines), 'Lignes de log (le cache intercepte avant le log)');`,
        },
        {
          label: 'Un décorateur accepte n’importe quel RateProvider',
          code: php`$fake = new class implements RateProvider {
    public function rate(string $from, string $to): float { return 2.0; }
};
return Expect::all(
    Expect::near(2.0, (new CachedRateProvider($fake))->rate('A', 'B'), 'Cache autour d’un faux fournisseur'),
    Expect::near(2.0, (new LoggedRateProvider($fake, new Logbook()))->rate('A', 'B'), 'Log autour d’un faux fournisseur'),
);`,
        },
      ],
      hints: [
        "Extrais d'abord l'interface : la seule méthode que l'appelant utilise, c'est `rate()`. Ensuite, retire de `EcbRateProvider` tout ce qui n'est pas « aller chercher le taux ».",
        "Un décorateur a toujours la même forme : `implements RateProvider`, un `private RateProvider $inner` reçu au constructeur, et une méthode `rate()` qui finit par appeler `$this->inner->rate(…)`.",
        "Pour le cache : `return $this->cache[\"$from/$to\"] ??= $this->inner->rate($from, $to);`. Pour le log : appelle l'intérieur, écris la ligne, renvoie le taux.",
      ],
      solution: php`<?php
declare(strict_types=1);

final class Logbook
{
    /** @var list<string> */
    public array $lines = [];

    public function add(string $line): void
    {
        $this->lines[] = $line;
    }
}

interface RateProvider
{
    public function rate(string $from, string $to): float;
}

final class EcbRateProvider implements RateProvider
{
    private const RATES = ['EUR/USD' => 1.08, 'EUR/GBP' => 0.85, 'EUR/JPY' => 162.0];

    public int $calls = 0;

    public function rate(string $from, string $to): float
    {
        $this->calls++; // appel HTTP simulé
        return self::RATES["$from/$to"] ?? throw new InvalidArgumentException("Paire inconnue : $from/$to");
    }
}

final class CachedRateProvider implements RateProvider
{
    /** @var array<string, float> */
    private array $cache = [];

    public function __construct(private RateProvider $inner)
    {
    }

    public function rate(string $from, string $to): float
    {
        return $this->cache["$from/$to"] ??= $this->inner->rate($from, $to);
    }
}

final class LoggedRateProvider implements RateProvider
{
    public function __construct(private RateProvider $inner, private Logbook $logbook)
    {
    }

    public function rate(string $from, string $to): float
    {
        $rate = $this->inner->rate($from, $to);
        $this->logbook->add("$from/$to = $rate");

        return $rate;
    }
}
`,
      solutionNote:
        "`EcbRateProvider` ne fait plus qu'une chose et se teste sans options. Chaque décorateur tient en quelques lignes et ne connaît que l'interface, donc il s'applique aussi à un autre fournisseur de taux. La composition (quelles couches, dans quel ordre) se décide à un seul endroit : la configuration des services.",
    },
    {
      title: 'Ajouter un retry',
      kind: 'Ajout',
      brief:
        "L'API de la BCE tombe parfois et lève une `RuntimeException`. Ajoute un décorateur qui **réessaie** : jusqu'à `$attempts` tentatives au total, puis il relance la dernière exception. Une erreur métier (paire inconnue, `InvalidArgumentException`) ne se réessaie pas : elle remonte tout de suite. Aucune autre classe ne change.",
      contract: [
        "Classe `RetryRateProvider(RateProvider $inner, int $attempts = 3)` qui implémente `RateProvider`",
        'Réessaie uniquement sur `RuntimeException`',
        "Après `$attempts` échecs : relance la dernière exception",
      ],
      tests: [
        {
          label: 'RetryRateProvider est un RateProvider',
          code: php`return Expect::implements('RetryRateProvider', 'RateProvider');`,
        },
        {
          label: 'Réussit après deux pannes',
          code: php`$flaky = new class implements RateProvider {
    public int $tries = 0;
    public function rate(string $from, string $to): float
    {
        if (++$this->tries <= 2) {
            throw new RuntimeException('BCE indisponible');
        }
        return 1.08;
    }
};
$rate = (new RetryRateProvider($flaky, 3))->rate('EUR', 'USD');
return Expect::all(
    Expect::near(1.08, $rate, 'Taux obtenu'),
    Expect::same(3, $flaky->tries, 'Tentatives'),
);`,
        },
        {
          label: 'Abandonne après N tentatives',
          code: php`$down = new class implements RateProvider {
    public int $tries = 0;
    public function rate(string $from, string $to): float
    {
        $this->tries++;
        throw new RuntimeException('BCE indisponible');
    }
};
return Expect::all(
    Expect::throws(RuntimeException::class, fn () => (new RetryRateProvider($down, 4))->rate('EUR', 'USD'), 'API toujours en panne'),
    Expect::same(4, $down->tries, 'Tentatives avec $attempts = 4'),
);`,
        },
        {
          label: 'Ne réessaie pas une erreur métier',
          code: php`$ecb = new EcbRateProvider();
return Expect::all(
    Expect::throws(InvalidArgumentException::class, fn () => (new RetryRateProvider($ecb))->rate('EUR', 'XYZ'), 'Paire inconnue'),
    Expect::same(1, $ecb->calls, 'Appels pour une paire inconnue'),
);`,
        },
        {
          label: 'Tout s’empile',
          code: php`$ecb = new EcbRateProvider();
$log = new Logbook();
$stack = new LoggedRateProvider(new RetryRateProvider(new CachedRateProvider($ecb)), $log);
$stack->rate('EUR', 'GBP');
$stack->rate('EUR', 'GBP');
return Expect::all(
    Expect::same(1, $ecb->calls, 'Appels réseau'),
    Expect::same(['EUR/GBP = 0.85', 'EUR/GBP = 0.85'], $log->lines, 'Journal'),
);`,
        },
      ],
      hints: [
        'Même squelette que les deux autres décorateurs, avec une boucle autour de l’appel à `$this->inner`.',
        "Attrape seulement `RuntimeException` : un `catch (Throwable)` réessaierait aussi les erreurs métier. Garde l'exception dans une variable pour la relancer à la fin.",
        "`for ($i = 1; ; $i++) { try { return $this->inner->rate($from, $to); } catch (RuntimeException $e) { if ($i >= $this->attempts) { throw $e; } } }`",
      ],
      solution: php`final class RetryRateProvider implements RateProvider
{
    public function __construct(private RateProvider $inner, private int $attempts = 3)
    {
    }

    public function rate(string $from, string $to): float
    {
        for ($try = 1; ; $try++) {
            try {
                return $this->inner->rate($from, $to);
            } catch (RuntimeException $e) {
                if ($try >= $this->attempts) {
                    throw $e;
                }
            }
        }
    }
}
`,
      solutionNote:
        "Une nouvelle couche, rien de modifié ailleurs. Le test d'empilement montre la vraie question d'architecture : où placer chaque couche ? Ici le retry est sous le log : le journal garde une seule ligne par demande, quel que soit le nombre de tentatives, et le cache ne stocke que des taux réellement obtenus. Symfony fait exactement ça avec `RetryableHttpClient`.",
    },
  ],
}
