import { useEffect, useState } from 'react';

export type LanguageCode = 'en' | 'es' | 'fr' | 'pt';
export const LANGUAGE_CHANGED_EVENT = 'moraltown:language-changed';
const LANGUAGE_STORAGE_KEY = 'moraltown:language';

export const languages: Array<{ code: LanguageCode; name: string; locale: string }> = [
  { code: 'en', name: 'English', locale: 'en' },
  { code: 'es', name: 'Español', locale: 'es' },
  { code: 'fr', name: 'Français', locale: 'fr' },
  { code: 'pt', name: 'Português', locale: 'pt-BR' },
];

const rows: Array<[string, string, string, string]> = [
  ["Inbox","Bandeja de entrada","Boîte de réception","Caixa de entrada"],
  ["Starred","Destacados","Suivis","Com estrela"],
  ["Sent","Enviados","Envoyés","Enviados"],
  ["Drafts","Borradores","Brouillons","Rascunhos"],
  ["Spam","Spam","Spam","Spam"],
  ["Check","Verificar","Vérifier","Verificar"],
  ["Mailbox","Buzón","Boîte aux lettres","Caixa de correio"],
  ["Your folders","Tus carpetas","Vos dossiers","Suas pastas"],
  ["Compose","Redactar","Composer","Escrever"],
  ["Settings","Configuración","Paramètres","Configurações"],
  ["Admin","Admin","Admin","Admin"],
  ["Admin console","Consola de administración","Console d'administration","Console de administração"],
  ["Sign in","Iniciar sesión","Se connecter","Entrar"],
  ["Create account","Crear cuenta","Créer un compte","Criar conta"],
  ["Sign out","Cerrar sesión","Se déconnecter","Sair"],
  ["Create account.","Crear cuenta.","Créer un compte.","Criar conta."],
  ["Welcome back.","Bienvenido de nuevo.","Bon retour.","Bem-vindo de volta."],
  ["Use the key you were given to enter your mailbox.","Usa la clave que recibiste para entrar a tu buzón.","Utilisez la clé qui vous a été remise pour accéder à votre boîte aux lettres.","Use a chave que você recebeu para entrar na sua caixa de correio."],
  ["Generate your private key, then choose the name people will email.","Genera tu clave privada, luego elige el nombre que verán los demás al recibir tus correos.","Générez votre clé privée, puis choisissez le nom que les gens verront lors de la réception de vos e-mails.","Gere sua chave privada, então escolha o nome que as pessoas verão ao receber seus e-mails."],
  ["Sign in with an encrypted key file","Iniciar sesión con un archivo de clave cifrada","Se connecter avec un fichier de clé chiffrée","Entrar com um arquivo de chave criptografada"],
  ["Username","Nombre de usuario","Nom d'utilisateur","Nome de usuário"],
  ["50-character access key","Clave de acceso de 50 caracteres","Clé d'accès de 50 caractères","Chave de acesso de 50 caracteres"],
  ["Save this generated key. It is the only way back into your mailbox.","Guarda esta clave generada. Es la única forma de volver a entrar a tu buzón.","Enregistrez cette clé générée. C'est le seul moyen d'accéder à nouveau à votre boîte aux lettres.","Salve esta chave gerada. É a única maneira de voltar à sua caixa de correio."],
  ["Enter mailbox","Entrar al buzón","Accéder à la boîte aux lettres","Entrar na caixa de correio"],
  ["Create private mailbox","Crear buzón privado","Créer une boîte aux lettres privée","Criar caixa de correio privada"],
  ["Create a MoralTown account","Crear una cuenta de MoralTown","Créer un compte MoralTown","Criar uma conta MoralTown"],
  ["Choose how to join.","Elige cómo unirte.","Choisissez comment rejoindre.","Escolha como participar."],
  ["Use a free access code or make a one-time $15 lifetime purchase with BTC, SOL, ETH, or LTC.","Usa un código de acceso gratuito o realiza una compra única de $15 de por vida con BTC, SOL, ETH o LTC.","Utilisez un code d'accès gratuit ou effectuez un achat unique de 15 $ à vie avec BTC, SOL, ETH ou LTC.","Use um código de acesso gratuito ou faça uma compra única vitalícia de $15 com BTC, SOL, ETH ou LTC."],
  ["Enter an access code","Ingresar un código de acceso","Saisir un code d'accès","Inserir um código de acesso"],
  ["Buy lifetime access · $15","Comprar acceso de por vida · $15","Acheter un accès à vie · 15 $","Comprar acesso vitalício · $15"],
  ["Your generated access key cannot be recovered if you lose it. Save it somewhere secure.","Tu clave de acceso generada no se puede recuperar si la pierdes. Guárdala en un lugar seguro.","Votre clé d'accès générée ne peut pas être récupérée si vous la perdez. Enregistrez-la dans un endroit sûr.","Sua chave de acesso gerada não pode ser recuperada se você a perder. Guarde-a em um local seguro."],
  ["Free access","Acceso gratuito","Accès gratuit","Acesso gratuito"],
  ["Enter your access code.","Ingresa tu código de acceso.","Saisissez votre code d'accès.","Insira seu código de acesso."],
  ["The code unlocks account creation. You will still receive a separate 50-digit key for signing in.","El código desbloquea la creación de cuenta. Aún recibirás una clave de 50 dígitos separada para iniciar sesión.","Le code déverrouille la création de compte. Vous recevrez toujours une clé distincte de 50 chiffres pour vous connecter.","O código desbloqueia a criação da conta. Você ainda receberá uma chave separada de 50 dígitos para entrar."],
  ["Continue","Continuar","Continuer","Continuar"],
  ["Control room","Sala de control","Salle de contrôle","Sala de controle"],
  ["Tune your mailbox, protect your access, and keep the room yours.","Ajusta tu buzón, protege tu acceso y mantén la sala bajo tu control.","Ajustez votre boîte aux lettres, protégez votre accès et gardez le contrôle de la salle.","Ajuste sua caixa de correio, proteja seu acesso e mantenha a sala sob seu controle."],
  ["Workspace ready","Espacio de trabajo listo","Espace de travail prêt","Espaço de trabalho pronto"],
  ["Identity","Identidad","Identité","Identidade"],
  ["Your mailbox","Tu buzón","Votre boîte aux lettres","Sua caixa de correio"],
  ["Keep your display name and receiving address recognizable.","Mantén tu nombre visible y dirección de recepción reconocibles.","Gardez votre nom d'affichage et votre adresse de réception reconnaissables.","Mantenha seu nome de exibição e endereço de recebimento reconhecíveis."],
  ["Display name","Nombre visible","Nom d'affichage","Nome de exibição"],
  ["Save","Guardar","Enregistrer","Salvar"],
  ["Receiving address","Dirección de recepción","Adresse de réception","Endereço de recebimento"],
  ["Address changes remaining:","Cambios de dirección restantes:","Changements d'adresse restants :","Mudanças de endereço restantes:"],
  ["Account access","Acceso a la cuenta","Accès au compte","Acesso à conta"],
  ["Access key","Clave de acceso","Clé d'accès","Chave de acesso"],
  ["Reveal, refresh, or save an encrypted backup. Treat this key like a password and keep a copy somewhere you control.","Revela, actualiza o guarda una copia de seguridad cifrada. Trata esta clave como una contraseña y guarda una copia donde tú tengas el control.","Révélez, actualisez ou enregistrez une sauvegarde chiffrée. Traitez cette clé comme un mot de passe et conservez-en une copie sous votre contrôle.","Revele, atualize ou salve um backup criptografado. Trate esta chave como uma senha e mantenha uma cópia onde você tenha controle."],
  ["Refresh key","Actualizar clave","Actualiser la clé","Atualizar chave"],
  ["Reveal key","Revelar clave","Révéler la clé","Revelar chave"],
  ["Save file","Guardar archivo","Enregistrer le fichier","Salvar arquivo"],
  ["Privacy controls","Controles de privacidad","Contrôles de confidentialité","Controles de privacidade"],
  ["Anonymous mode","Modo anónimo","Mode anonyme","Modo anônimo"],
  ["MoralTown does not add optional analytics. This mode masks rendered account and sender addresses on this device; it cannot hide network, provider, or server records.","MoralTown no añade analíticas opcionales. Este modo enmascara las direcciones de cuenta y remitente renderizadas en este dispositivo; no puede ocultar registros de red, proveedor o servidor.","MoralTown n'ajoute pas d'analyses facultatives. Ce mode masque les adresses de compte et d'expéditeur rendues sur cet appareil ; il ne peut pas masquer les enregistrements réseau, fournisseur ou serveur.","O MoralTown não adiciona análises opcionais. Este modo mascara as contas e endereços de remetente renderizados neste dispositivo; não pode ocultar registros de rede, provedor ou servidor."],
  ["Mask email addresses","Enmascarar direcciones de correo","Masquer les adresses e-mail","Mascarar endereços de e-mail"],
  ["Blur account and sender addresses in the interface only.","Desenfocar direcciones de cuenta y remitente solo en la interfaz.","Flouter les adresses de compte et d'expéditeur uniquement dans l'interface.","Desfocar endereços de conta e remetente apenas na interface."],
  ["Reduce motion","Reducir movimiento","Réduire le mouvement","Reduzir movimento"],
  ["Turn off decorative movement. Your device’s reduced-motion setting is also respected.","Desactiva el movimiento decorativo. También se respeta la configuración de reducción de movimiento de tu dispositivo.","Désactivez le mouvement décoratif. Le paramètre de réduction du mouvement de votre appareil est également respecté.","Desative movimentos decorativos. A configuração de redução de movimento do seu dispositivo também é respeitada."],
  ["Automatic sign-out","Cierre de sesión automático","Déconnexion automatique","Sair automaticamente"],
  ["Sign out after five minutes without activity. Unsaved compose text may be lost.","Cerrar sesión después de cinco minutos de inactividad. El texto de redacción no guardado podría perderse.","Déconnexion après cinq minutes d'inactivité. Le texte de composition non enregistré pourrait être perdu.","Sair após cinco minutos de inatividade. O texto de composição não salvo pode ser perdido."],
  ["Subscriptions","Suscripciones","Abonnements","Assinaturas"],
  ["Useful senders","Remitentes útiles","Expéditeurs utiles","Remetentes úteis"],
  ["Keep a small list of addresses that are allowed to deliver attention to you.","Mantén una pequeña lista de direcciones autorizadas para enviarte notificaciones.","Conservez une petite liste d'adresses autorisées à vous envoyer des notifications.","Mantenha uma pequena lista de endereços autorizados a entregar atenção a você."],
  ["Add","Añadir","Ajouter","Adicionar"],
  ["No subscriptions yet.","Aún no hay suscripciones.","Aucun abonnement pour le moment.","Nenhuma assinatura ainda."],
  ["Active","Activo","Actif","Ativo"],
  ["Paused","Pausado","En pause","Pausado"],
  ["Organization","Organización","Organisation","Organização"],
  ["Mailbox folders","Carpetas del buzón","Dossiers de la boîte aux lettres","Pastas da caixa de correio"],
  ["Give recurring messages a place to land.","Dale un lugar a los mensajes recurrentes.","Donnez aux messages récurrents un endroit où atterrir.","Dê às mensagens recorrentes um lugar para ficar."],
  ["New folder name","Nombre de la nueva carpeta","Nom du nouveau dossier","Nome da nova pasta"],
  ["Create","Crear","Créer","Criar"],
  ["Activity","Actividad","Activité","Atividade"],
  ["Notifications","Notificaciones","Notifications","Notificações"],
  ["Recent events from your MoralTown workspace.","Eventos recientes de tu espacio de trabajo MoralTown.","Événements récents de votre espace de travail MoralTown.","Eventos recentes do seu espaço de trabalho MoralTown."],
  ["No new notifications.","No hay notificaciones nuevas.","Aucune nouvelle notification.","Nenhuma notificação nova."],
  ["Read","Leído","Lu","Lido"],
  ["Mark read","Marcar como leído","Marquer comme lu","Marcar como lido"],
  ["Email delivery relies on external mail services and networks, each with its own handling practices.","La entrega de correo depende de redes y servicios de correo externos, cada uno con sus propias prácticas de manejo.","La livraison d'e-mails repose sur des services et réseaux de messagerie externes, chacun avec ses propres pratiques de gestion.","A entrega de e-mail depende de redes e serviços de correio externos, cada um com suas próprias práticas de manuseio."],
  ["Your quiet space","Tu espacio tranquilo","Votre espace calme","Seu espaço tranquilo"],
  ["Nothing asking for you.","Nada que requiera tu atención.","Rien ne vous réclame.","Nada pedindo por você."],
  ["This space is clear. When something arrives, it will wait here.","Este espacio está despejado. Cuando algo llegue, esperará aquí.","Cet espace est libre. Quand quelque chose arrive, il attendra ici.","Este espaço está limpo. Quando algo chegar, esperará aqui."],
  ["Search mailbox","Buscar en el buzón","Rechercher dans la boîte aux lettres","Pesquisar na caixa de correio"],
  ["Refresh messages","Actualizar mensajes","Actualiser les messages","Atualizar mensagens"],
  ["A clear subject","Un asunto claro","Un sujet clair","Um assunto claro"],
  ["Write with care…","Escribe con cuidado…","Écrivez avec soin…","Escreva com cuidado…"],
  ["Send message","Enviar mensaje","Envoyer le message","Enviar mensagem"],
  ["To","Para","À","Para"],
  ["Subject","Asunto","Objet","Assunto"],
  ["Back to inbox","Volver a la bandeja de entrada","Retour à la boîte de réception","Voltar para a caixa de entrada"],
  ["A quiet interruption.","Una interrupción tranquila.","Une interruption calme.","Uma interrupção tranquila."],
  ["We could not reach the mailbox just now. Check your connection and try again.","No pudimos acceder al buzón en este momento. Revisa tu conexión e inténtalo de nuevo.","Nous n'avons pas pu accéder à la boîte aux lettres pour le moment. Vérifiez votre connexion et réessayez.","Não conseguimos acessar a caixa de correio agora. Verifique sua conexão e tente novamente."],
  ["Try again","Inténtalo de nuevo","Réessayer","Tente novamente"],
  ["System check","Verificación del sistema","Vérification du système","Verificação do sistema"],
  ["Security & availability","Seguridad y disponibilidad","Sécurité et disponibilité","Segurança e disponibilidade"],
  ["Mailbox readiness","Disponibilidad del buzón","Disponibilité de la boîte aux lettres","Prontidão da caixa de correio"],
  ["Required services","Servicios requeridos","Services requis","Serviços necessários"],
  ["Registered routes","Rutas registradas","Routes enregistrées","Rotas registradas"],
  ["No service checks were returned.","No se devolvieron comprobaciones de servicio.","Aucune vérification de service n'a été renvoyée.","Nenhuma verificação de serviço retornada."],
  ["No route checks were returned.","No se devolvieron comprobaciones de ruta.","Aucune vérification de route n'a été renvoyée.","Nenhuma verificação de rota retornada."],
  ["DO NOT USE THE MAILBOX","NO USES EL BUZÓN","N'UTILISEZ PAS LA BOÎTE AUX LETTRES","NÃO USE A CAIXA DE CORREIO"],
  ["Refresh status","Actualizar estado","Actualiser le statut","Atualizar status"],
  ["Quietly lost","Perdido tranquilamente","Perdu calmement","Perdido tranquilamente"],
  ["This address is empty.","Esta dirección está vacía.","Cette adresse est vide.","Este endereço está vazio."],
  ["The page you’re looking for is not part of MoralTown.","La página que buscas no forma parte de MoralTown.","La page que vous recherchez ne fait pas partie de MoralTown.","A página que você está procurando não faz parte do MoralTown."],
  ["Return to home","Volver al inicio","Retour à l'accueil","Voltar para a página inicial"],
  ["Lifetime access","Acceso de por vida","Accès à vie","Acesso vitalício"],
  ["One-time purchase","Compra única","Achat unique","Compra única"],
  ["Pay once. No subscription.","Paga una vez. Sin suscripción.","Payez une fois. Pas d'abonnement.","Pague uma vez. Sem assinatura."],
  ["Buy now","Comprar ahora","Acheter maintenant","Comprar agora"],
  ["Choose a network","Elige una red","Choisir un réseau","Escolha uma rede"],
  ["Payment verified","Pago verificado","Paiement vérifié","Pagamento verificado"],
  ["Payment method","Método de pago","Méthode de paiement","Método de pagamento"],
  ["Payment window","Ventana de pago","Fenêtre de paiement","Janela de pagamento"],
  ["Process started","Proceso iniciado","Processus démarré","Processo iniciado"],
  ["Your payment address","Tu dirección de pago","Votre adresse de paiement","Seu endereço de pagamento"],
  ["Workspace announcement","Anuncio del espacio de trabajo","Annonce de l'espace de travail","Anúncio do espaço de trabalho"],
  ["Workspace notice","Aviso del espacio de trabajo","Avis de l'espace de travail","Aviso do espaço de trabalho"],
  ["Users & roles","Usuarios y roles","Utilisateurs et rôles","Usuários e funções"],
  ["Filter accounts","Filtrar cuentas","Filtrer les comptes","Filtrar contas"],
  ["No accounts match that filter.","Ninguna cuenta coincide con ese filtro.","Aucun compte ne correspond à ce filtre.","Nenhuma conta corresponde a esse filtro."],
  ["Recent actions","Acciones recientes","Actions récentes","Ações recentes"],
  ["Audit trail","Registro de auditoría","Piste d'audit","Trilha de auditoria"],
  ["No audit events available.","No hay eventos de auditoría disponibles.","Aucun événement d'audit disponible.","Nenhum evento de auditoria disponível."],
  ["Aggregate activity","Actividad agregada","Activité globale","Atividade agregada"],
  ["API traffic snapshot","Instantánea de tráfico API","Instantané du trafic API","Snapshot de tráfego da API"],
  ["Email addresses are intentionally not shown.","Las direcciones de correo electrónico no se muestran intencionalmente.","Les adresses e-mail ne sont intentionnellement pas affichées.","Endereços de e-mail intencionalmente não são exibidos."],
  ["Overview unavailable","Resumen no disponible","Vue d'ensemble indisponible","Visão geral indisponível"],
  ["Retry overview","Reintentar resumen","Réessayer la vue d'ensemble","Tentar visão geral novamente"],
  ["Retry users","Reintentar usuarios","Réessayer les utilisateurs","Tentar usuários novamente"],
  ["Retry checks","Reintentar comprobaciones","Réessayer les vérifications","Tentar verificações novamente"],
  ["Restricted operations.","Operaciones restringidas.","Opérations restreintes.","Operações restritas."],
  ["Changes take effect through server-enforced controls.","Los cambios surten efecto mediante controles aplicados por el servidor.","Les modifications prennent effet via des contrôles appliqués par le serveur.","As alterações entram em vigor por meio de controles impostos pelo servidor."],
  ["Language","Idioma","Langue","Idioma"],
  ["Theme","Tema","Thème","Tema"],
  ["Appearance","Apariencia","Apparence","Aparência"],
  ["Color theme","Tema de color","Thème de couleur","Tema de cor"],
  ["English","Inglés","Anglais","Inglês"],
  ["Spanish","Español","Espagnol","Espanhol"],
  ["French","Francés","Français","Francês"],
  ["Portuguese","Portugués","Portugais","Português"],
  ["Unlock your mailbox from an encrypted MoralTown key file.","Desbloquea tu buzón con un archivo de clave cifrada de MoralTown.","Déverrouillez votre boîte mail à l'aide d'un fichier de clé chiffrée MoralTown.","Desbloqueie sua caixa de correio com um arquivo de chave criptografada MoralTown."],
  ["That access key was not accepted. Check it and try again.","Esa clave de acceso no fue aceptada. Compruébala e inténtalo de nuevo.","Cette clé d'accès n'a pas été acceptée. Vérifiez-la et réessayez.","Essa chave de acesso não foi aceita. Verifique-a e tente novamente."],
  ["Your access key must be exactly 50 characters.","Tu clave de acceso debe tener exactamente 50 caracteres.","Votre clé d'accès doit comporter exactement 50 caractères.","Sua chave de acesso deve ter exatamente 50 caracteres."],
  ["Choose a username with at least one letter.","Elige un nombre de usuario con al menos una letra.","Choisissez un nom d'utilisateur contenant au moins une lettre.","Escolha um nome de usuário com pelo menos uma letra."],
  ["We could not create this account. Check the access code or payment status, then try again.","No pudimos crear esta cuenta. Verifica el código de acceso o el estado del pago e inténtalo de nuevo.","Nous n'avons pas pu créer ce compte. Vérifiez le code d'accès ou le statut du paiement, puis réessayez.","Não foi possível criar esta conta. Verifique o código de acesso ou o status do pagamento e tente novamente."],
  ["Complete the human check before continuing.","Completa la verificación humana antes de continuar.","Effectuez la vérification humaine avant de continuer.","Conclua a verificação humana antes de continuar."],
  ["The security check could not be prepared. Refresh the page and try again.","No se pudo preparar la verificación de seguridad. Actualiza la página e inténtalo de nuevo.","La vérification de sécurité n'a pas pu être préparée. Actualisez la page et réessayez.","A verificação de segurança não pôde ser preparada. Atualize a página e tente novamente."],
  ["That access code was not accepted.","Ese código de acceso no fue aceptado.","Ce code d'accès n'a pas été accepté.","Esse código de acesso não foi aceito."],
  ["We could not verify that code just now. Please try again.","No pudimos verificar ese código en este momento. Por favor, inténtalo de nuevo.","Nous n'avons pas pu vérifier ce code pour le moment. Veuillez réessayer.","Não foi possível verificar esse código no momento. Por favor, tente novamente."],
  ["Choose your encrypted key file and enter its passphrase.","Elige tu archivo de clave cifrada e introduce su contraseña.","Choisissez votre fichier de clé chiffrée et saisissez sa phrase secrète.","Escolha seu arquivo de chave criptografada e insira sua senha."],
  ["That credential file could not be opened.","No se pudo abrir ese archivo de credenciales.","Impossible d'ouvrir ce fichier d'identification.","Não foi possível abrir esse arquivo de credenciais."],
  ["Access key copied.","Clave de acceso copiada.","Clé d'accès copiée.","Chave de acesso copiada."],
  ["Loading human check…","Cargando verificación humana…","Chargement de la vérification humaine…","Carregando verificação humana…"],
  ["Answer","Responder","Répondre","Responder"],
  ["Your mailbox will be","Tu buzón será","Votre boîte mail sera","Sua caixa de correio será"],
  ["your name","tu nombre","votre nom","seu nome"],
  ["enter your private key","introduce tu clave privada","saisissez votre clé privée","insira sua chave privada"],
  ["Opening secure channel…","Abriendo canal seguro…","Ouverture du canal sécurisé…","Abrindo canal seguro…"],
  ["Unlock key file","Desbloquear archivo de clave","Déverrouiller le fichier de clé","Desbloquear arquivo de chave"],
  ["Choose your encrypted key file","Elige tu archivo de clave cifrada","Choisissez votre fichier de clé chiffrée","Escolha seu arquivo de chave criptografada"],
  ["Encrypted locally. The file passphrase never leaves your browser.","Cifrado localmente. La contraseña del archivo nunca sale de tu navegador.","Chiffré localement. La phrase secrète du fichier ne quitte jamais votre navigateur.","Criptografado localmente. A senha do arquivo nunca sai do seu navegador."],
  ["File passphrase","Contraseña del archivo","Phrase secrète du fichier","Senha do arquivo"],
  ["File passphrase (8+ characters)","Contraseña del archivo (8+ caracteres)","Phrase secrète du fichier (8 caractères ou plus)","Senha do arquivo (8+ caracteres)"],
  ["Back to access key","Volver a la clave de acceso","Retour à la clé d'accès","Voltar à chave de acesso"],
  ["Sessions use a secure browser cookie. Encrypted key files never contain session cookies.","Las sesiones utilizan una cookie de navegador segura. Los archivos de clave cifrada nunca contienen cookies de sesión.","Les sessions utilisent un cookie de navigateur sécurisé. Les fichiers de clés chiffrées ne contiennent jamais de cookies de session.","As sessões usam um cookie de navegador seguro. Arquivos de chave criptografada nunca contêm cookies de sessão."],
  ["Back to options","Volver a las opciones","Retour aux options","Voltar às opções"],
  ["Choose your theme","Elige tu tema","Choisissez votre thème","Escolha seu tema"],
  ["Pick an accent palette. Your choice is saved on this device and used throughout the app.","Elige una paleta de acento. Tu elección se guarda en este dispositivo y se utiliza en toda la aplicación.","Choisissez une palette d'accentuation. Votre choix est enregistré sur cet appareil et utilisé dans toute l'application.","Escolha uma paleta de cores de destaque. Sua escolha é salva neste dispositivo e usada em todo o aplicativo."],
  ["Ember","Ámbar","Ambre","Âmbar"],
  ["Violet","Violeta","Violet","Violeta"],
  ["Ocean","Océano","Océan","Oceano"],
  ["Forest","Bosque","Forêt","Floresta"],
  ["Gold","Oro","Or","Ouro"],
  ["Crimson and carbon","Carmesí y carbono","Cramoisi et carbone","Carmesim e carbono"],
  ["Electric violet","Violeta eléctrico","Violet électrique","Violeta elétrico"],
  ["Cool blue glass","Vidrio azul frío","Verre bleu froid","Vidro azul frio"],
  ["Deep green","Verde profundo","Vert profond","Verde profundo"],
  ["Warm amber","Ámbar cálido","Ambre chaud","Âmbar quente"],
  ["Navigation","Navegación","Navigation","Navegação"],
  ["Sending","Enviando","Envoi","Enviando"],
  ["Receiving","Recibiendo","Réception","Recebendo"],
  ["Open workspace menu","Abrir menú del espacio de trabajo","Ouvrir le menu de l'espace de travail","Abrir menu do espaço de trabalho"],
  ["Close navigation","Cerrar navegación","Fermer la navigation","Fechar navegação"],
  ["MoralTown announcement","Anuncio de MoralTown","Annonce MoralTown","Anúncio MoralTown"],
  ["Mailbox access is temporarily unavailable.","El acceso al buzón no está disponible temporalmente.","L'accès à la boîte mail est temporairement indisponible.","O acesso à caixa de correio está temporariamente indisponível."],
  ["MoralTown service notice","Aviso de servicio de MoralTown","Avis de service MoralTown","Aviso de serviço MoralTown"],
  ["Admin sign in","Inicio de sesión de administrador","Connexion administrateur","Login de administrador"],
  ["Close this page","Cerrar esta página","Fermer cette page","Fechar esta página"],
  ["Closing session…","Cerrando sesión…","Fermeture de session…","Encerrando sessão…"],
  ["All messages","Todos los mensajes","Tous les messages","Todas as mensagens"],
  ["mailbox refreshes automatically","el buzón se actualiza automáticamente","la boîte mail s'actualise automatiquement","a caixa de correio é atualizada automaticamente"],
  ["Refresh","Actualizar","Actualiser","Atualizar"],
  ["Message stayed here. Please check the recipient and try again.","El mensaje se quedó aquí. Por favor, comprueba el destinatario e inténtalo de nuevo.","Le message est resté ici. Veuillez vérifier le destinataire et réessayez.","A mensagem permaneceu aqui. Por favor, verifique o destinatário e tente novamente."],
  ["The message stayed here. Please check the recipient and try again.","El mensaje se quedó aquí. Por favor, comprueba el destinatario e inténtalo de nuevo.","Le message est resté ici. Veuillez vérifier le destinataire et réessayez.","A mensagem permaneceu aqui. Por favor, verifique o destinatário e tente novamente."],
  ["The message stayed here. Please check recipient and try again.","El mensaje se quedó aquí. Comprueba el destinatario e inténtalo de nuevo.","Le message est resté ici. Vérifiez le destinataire et réessayez.","A mensagem permaneceu aqui. Verifique o destinatário e tente novamente."],
  ["Message stayed here. Please check recipient and try again.","El mensaje se quedó aquí. Comprueba el destinatario e inténtalo de nuevo.","Le message est resté ici. Vérifiez le destinataire et réessayez.","A mensagem permaneceu aqui. Verifique o destinatário e tente novamente."],
  ["Message could not be sent. Try again.","No se pudo enviar el mensaje. Inténtalo de nuevo.","Le message n'a pas pu être envoyé. Réessayez.","Não foi possível enviar a mensagem. Tente novamente."],
  ["Message sent.","Mensaje enviado.","Message envoyé.","Mensagem enviada."],
  ["Sending message…","Enviando mensaje…","Envoi du message…","Enviando mensagem…"],
  ["No messages yet","Aún no hay mensajes","Aucun message pour l'instant","Nenhuma mensagem ainda"],
  ["No more messages","No hay más mensajes","Plus de messages","Sem mais mensagens"],
  ["Profile updated.","Perfil actualizado.","Profil mis à jour.","Perfil atualizado."],
  ["Folder created.","Carpeta creada.","Dossier créé.","Pasta criada."],
  ["Access key refreshed. Save the new key now.","Clave de acceso actualizada. Guarda la nueva clave ahora.","Clé d'accès actualisée. Enregistrez la nouvelle clé maintenant.","Chave de acesso atualizada. Salve a nova chave agora."],
  ["The access key could not be refreshed. Try again.","No se pudo actualizar la clave de acceso. Inténtalo de nuevo.","La clé d'accès n'a pas pu être actualisée. Réessayez.","Não foi possível atualizar a chave de acesso. Tente novamente."],
  ["Use at least 8 characters for the file passphrase.","Usa al menos 8 caracteres para la contraseña del archivo.","Utilisez au moins 8 caractères pour la phrase secrète du fichier.","Use pelo menos 8 caracteres para a senha do arquivo."],
  ["Reveal or refresh the access key before exporting it.","Revela o actualiza la clave de acceso antes de exportarla.","Révélez ou actualisez la clé d'accès avant de l'exporter.","Revele ou atualize a chave de acesso antes de exportá-la."],
  ["Encrypted key file downloaded.","Archivo de clave cifrada descargado.","Fichier de clé chiffrée téléchargé.","Arquivo de chave criptografada baixado."],
  ["Subscription added.","Suscripción añadida.","Abonnement ajouté.","Assinatura adicionada."],
  ["Choose a language","Elige un idioma","Choisissez une langue","Escolha um idioma"],
  ["Accent palette","Paleta de acento","Palette d'accentuation","Paleta de cores de destaque"],
  ["in series","en serie","en série","em série"],
  ["Unable to load admin overview.","No se pudo cargar la vista general de administrador.","Impossible de charger la vue d'ensemble administrateur.","Não foi possível carregar a visão geral do administrador."],
  ["Unable to load user directory.","No se pudo cargar el directorio de usuarios.","Impossible de charger le répertoire utilisateur.","Não foi possível carregar o diretório de usuários."],
  ["API pause","Pausa de API","Pause API","Pausa da API"],
  ["Request failed.","La solicitud falló.","La requête a échoué.","A solicitação falhou."],
  ["Announcement published.","Anuncio publicado.","Annonce publiée.","Anúncio publicado."],
  ["Announcement cleared.","Anuncio borrado.","Annonce effacée.","Anúncio limpo."],
  ["Trusted operations","Operaciones confiables","Opérations de confiance","Operações confiáveis"],
  ["A privacy-first view of service operations. Message contents and credential values never appear here.","Una vista centrada en la privacidad de las operaciones de servicio. El contenido de los mensajes y los valores de las credenciales nunca aparecen aquí.","Une vue des opérations de service axée sur la confidentialité. Le contenu des messages et les valeurs des identifiants n'apparaissent jamais ici.","Uma visão das operações de serviço com foco em privacidade. O conteúdo das mensagens e os valores das credenciais nunca aparecem aqui."],
  ["Signed in as","Sesión iniciada como","Connecté en tant que","Conectado como"],
  ["Refresh admin data","Actualizar datos de administrador","Actualiser les données admin","Atualizar dados do administrador"],
  ["Your account can view available data but cannot change operating controls","Su cuenta puede ver los datos disponibles pero no puede cambiar los controles operativos","Votre compte peut voir les données disponibles mais ne peut pas modifier les contrôles opérationnels","Sua conta pode visualizar os dados disponíveis, mas não pode alterar os controles operacionais"],
  ["or roles","o roles","ou les rôles","ou funções"],
  [". A trusted admin or co-founder account is required.",". Se requiere una cuenta de administrador confiable o de cofundador.",". Un compte administrateur ou cofondateur de confiance est requis.",". É necessária uma conta de administrador ou cofundador confiável."],
  ["Loading admin overview","Cargando vista general de administrador","Chargement de la vue d'ensemble admin","Carregando visão geral do administrador"],
  ["Privacy-safe activity totals","Totales de actividad seguros para la privacidad","Totaux d'activité sécurisés","Totais de atividade com privacidade segura"],
  ["registered mailboxes","buzones registrados","boîtes mail enregistrées","caixas de correio registradas"],
  ["Sent today","Enviados hoy","Envoyés aujourd'hui","Enviados hoje"],
  ["message count only","solo conteo de mensajes","nombre de messages uniquement","apenas contagem de mensagens"],
  ["Received today","Recibidos hoy","Reçus aujourd'hui","Recebidos hoje"],
  ["API requests","Solicitudes de API","Requêtes API","Solicitações de API"],
  ["since this process started","desde que comenzó este proceso","depuis le début de ce processus","desde que este processo iniciou"],
  ["Workspace pulse","Pulso del espacio de trabajo","Pulse de l'espace de travail","Pulso do espaço de trabalho"],
  ["No message data","Sin datos de mensajes","Aucune donnée de message","Sem dados de mensagens"],
  ["New accounts","Nuevas cuentas","Nouveaux comptes","Novas contas"],
  ["Counts only. No subjects, senders, recipients, or message bodies are collected in this view.","Solo conteos. No se recopilan asuntos, remitentes, destinatarios o cuerpos de mensajes en esta vista.","Comptages uniquement. Aucun sujet, expéditeur, destinataire ou corps de message n'est collecté dans cette vue.","Apenas contagens. Nenhum assunto, remetente, destinatário ou corpo de mensagem é coletado nesta visualização."],
  ["Request protection","Protección de solicitud","Protection des requêtes","Proteção de solicitação"],
  ["rate limited","límite de velocidad alcanzado","limite de taux atteinte","limite de taxa atingido"],
  ["Counters reset when this app process restarts. No IP addresses, message contents, or request bodies are retained.","Los contadores se reinician cuando este proceso de aplicación se reinicia. No se retienen direcciones IP, contenidos de mensajes o cuerpos de solicitud.","Les compteurs sont réinitialisés au redémarrage de ce processus d'application. Aucune adresse IP, contenu de message ou corps de requête n'est conservé.","Os contadores são redefinidos quando este processo do aplicativo reinicia. Nenhum endereço IP, conteúdo de mensagem ou corpo de solicitação é retido."],
  ["API route","Ruta de API","Route API","Rota da API"],
  ["Method","Método","Méthode","Método"],
  ["Requests","Solicitudes","Requêtes","Solicitações"],
  ["Service controls","Controles de servicio","Contrôles de service","Controles de serviço"],
  ["Operating posture","Postura operativa","Posture opérationnelle","Postura operacional"],
  ["Automatic resume","Reanudación automática","Reprise automatique","Retomada automática"],
  ["Used when API, sending, or receiving is paused.","Utilizado cuando la API, el envío o la recepción están en pausa.","Utilisé lorsque l'API, l'envoi ou la réception sont en pause.","Usado quando a API, o envio ou o recebimento estão em pausa."],
  ["15 minutes","15 minutos","15 minutes","15 minutos"],
  ["1 hour","1 hora","1 heure","1 hora"],
  ["6 hours","6 horas","6 heures","6 horas"],
  ["24 hours","24 horas","24 heures","24 horas"],
  ["Mailbox lockdown","Bloqueo de buzón","Verrouillage de boîte mail","Bloqueio de caixa de correio"],
  ["Stop mailbox access while an incident is contained.","Detener el acceso al buzón mientras se contiene un incidente.","Arrêter l'accès aux boîtes mail pendant la gestion d'un incident.","Interromper o acesso à caixa de correio enquanto um incidente é contido."],
  ["Pause API","Pausar API","Mettre l'API en pause","Pausar API"],
  ["Temporarily pause API traffic.","Pausar temporalmente el tráfico de la API.","Mettre temporairement le trafic API en pause.","Pausar temporariamente o tráfego da API."],
  ["Sending enabled","Envío habilitado","Envoi activé","Envio ativado"],
  ["Permit outbound mail delivery.","Permitir la entrega de correo saliente.","Autoriser la livraison de courrier sortant.","Permitir entrega de e-mail de saída."],
  ["Receiving enabled","Recepción habilitada","Réception activée","Recebimento ativado"],
  ["Permit inbound mail delivery.","Permitir la entrega de correo entrante.","Autoriser la livraison de courrier entrant.","Permitir entrega de e-mail de entrada."],
  ["Auto-resumes","Reanuda automáticamente","Reprise automatique","Retoma automaticamente"],
  ["Lockdown notice","Aviso de bloqueo","Avis de verrouillage","Aviso de bloqueio"],
  ["Short public-facing notice","Aviso corto de cara al público","Avis court pour le public","Aviso curto voltado ao público"],
  ["Save notice","Guardar aviso","Enregistrer l'avis","Salvar aviso"],
  ["Announcement","Anuncio","Annonce","Anúncio"],
  ["Published","Publicado","Publié","Publicado"],
  ["Write a short public workspace notice…","Escriba un aviso breve del espacio de trabajo para el público…","Écrivez un court avis public pour l'espace de travail...","Escreva um breve aviso público do espaço de trabalho..."],
  ["Publish notice","Publicar aviso","Publier l'avis","Publicar aviso"],
  ["Clear","Borrar","Effacer","Limpar"],
  ["Access directory","Acceder al directorio","Accéder au répertoire","Acessar diretório"],
  ["Filter username or role","Filtrar nombre de usuario o rol","Filtrer par nom d'utilisateur ou rôle","Filtrar por nome de usuário ou função"],
  ["Account","Cuenta","Compte","Conta"],
  ["Joined","Unido","Rejoint","Entrou em"],
  ["Role","Rol","Rôle","Função"],
  ["Account ID ·","ID de cuenta ·","ID de compte ·","ID da conta ·"],
  ["Role for","Rol para","Rôle pour","Função para"],
  ["shown","mostrado","affiché","exibido"],
  ["Operational events only; no mail contents.","Solo eventos operativos; sin contenido de correo.","Événements opérationnels uniquement ; aucun contenu de mail.","Apenas eventos operacionais; sem conteúdo de e-mail."],
  ["Controls are enforced by the API. This console never reads mailbox messages or displays configuration secrets.","Los controles son impuestos por la API. Esta consola nunca lee mensajes de buzón ni muestra secretos de configuración.","Les contrôles sont appliqués par l'API. Cette console ne lit jamais les messages des boîtes mail et n'affiche pas les secrets de configuration.","Os controles são aplicados pela API. Este console nunca lê mensagens de caixa de correio nem exibe segredos de configuração."],
  ["Challenge unavailable","Desafío no disponible","Challenge indisponible","Desafio indisponível"],
  ["· checking browser","· verificando navegador","· vérification du navigateur","· verificando navegador"],
  ["Human check answer","Respuesta de verificación humana","Réponse de vérification humaine","Resposta da verificação humana"],
  ["Copy generated access key","Copiar clave de acceso generada","Copier la clé d'accès générée","Copiar chave de acesso gerada"],
  ["Close account options","Cerrar opciones de cuenta","Fermer les options de compte","Fechar opções da conta"],
  ["Access code","Código de acceso","Code d'accès","Código de acesso"],
  ["Free access code","Código de acceso gratuito","Code d'accès gratuit","Código de acesso gratuito"],
  ["Unable to load security status.","No se puede cargar el estado de seguridad.","Impossible de charger l'état de sécurité.","Não foi possível carregar o status de segurança."],
  ["Account role could not be verified. Security status remains available to the signed-in session.","No se pudo verificar el rol de la cuenta. El estado de seguridad sigue disponible para la sesión iniciada.","Le rôle du compte n'a pas pu être vérifié. L'état de sécurité reste disponible pour la session connectée.","A função da conta não pôde ser verificada. O status de segurança permanece disponível para a sessão logada."],
  ["Status unavailable","Estado no disponible","État indisponible","Status indisponível"],
  ["Could not reach security checks","No se pudieron realizar las comprobaciones de seguridad","Impossible d'effectuer les contrôles de sécurité","Não foi possível realizar as verificações de segurança"],
  ["Loading security checks","Cargando comprobaciones de seguridad","Chargement des contrôles de sécurité","Carregando verificações de segurança"],
  ["Do not use the mailbox","No utilizar el buzón","Ne pas utiliser la boîte aux lettres","Não use a caixa de correio"],
  ["Required checks are active","Las comprobaciones requeridas están activas","Les contrôles requis sont actifs","As verificações necessárias estão ativas"],
  ["One or more required protections or delivery services are unavailable. Wait until all required checks are active before using the mailbox.","Una o más protecciones o servicios de entrega requeridos no están disponibles. Espere a que todas las comprobaciones requeridas estén activas antes de usar el buzón.","Une ou plusieurs protections ou services de livraison requis sont indisponibles. Attendez que tous les contrôles requis soient actifs avant d'utiliser la boîte aux lettres.","Uma ou mais proteções ou serviços de entrega necessários estão indisponíveis. Aguarde até que todas as verificações necessárias estejam ativas antes de usar a caixa de correio."],
  ["The reported service and encryption checks are active and the mailbox is ready.","Las comprobaciones de servicio y cifrado informadas están activas y el buzón está listo.","Les contrôles de service et de chiffrement signalés sont actifs et la boîte aux lettres est prête.","As verificações de serviço e criptografia relatadas estão ativas e a caixa de correio está pronta."],
  ["Action required","Acción requerida","Action requise","Ação necessária"],
  ["API traffic is paused.","El tráfico de la API está en pausa.","Le trafic de l'API est suspendu.","O tráfego da API está pausado."],
  ["Warnings","Advertencias","Avertissements","Avisos"],
  ["DO NOT USE THE MAILBOX.","NO UTILICE EL BUZÓN.","NE PAS UTILISER LA BOÎTE AUX LETTRES.","NÃO USE A CAIXA DE CORREIO."],
  ["Mail integrations are unavailable.","Las integraciones de correo no están disponibles.","Les intégrations de messagerie sont indisponibles.","As integrações de e-mail estão indisponíveis."],
  ["Encryption service is unavailable.","El servicio de cifrado no está disponible.","Le service de chiffrement est indisponible.","O serviço de criptografia está indisponível."],
  ["Wait for all required checks to return active.","Espere a que todas las comprobaciones requeridas vuelvan a estar activas.","Attendez que tous les contrôles requis soient à nouveau actifs.","Aguarde que todas as verificações necessárias voltem a ficar ativas."],
  ["Dependencies","Dependencias","Dépendances","Dependências"],
  ["Mailbox readiness cannot be confirmed without service status.","No se puede confirmar la disponibilidad del buzón sin el estado del servicio.","La disponibilité de la boîte aux lettres ne peut être confirmée sans l'état du service.","A prontidão da caixa de correio não pode ser confirmada sem o status do serviço."],
  ["No additional status detail provided.","No se proporcionaron detalles adicionales sobre el estado.","Aucun détail d'état supplémentaire fourni.","Nenhum detalhe de status adicional fornecido."],
  ["Check:","Comprobación:","Contrôle :","Verificação:"],
  ["API surface","Superficie de la API","Surface API","Superfície da API"],
  ["Route","Ruta","Route","Rota"],
  ["Methods","Métodos","Méthodes","Métodos"],
  ["State","Estado","État","Estado"],
  ["Only routes returned by the authenticated security check are listed.","Solo se muestran las rutas devueltas por la comprobación de seguridad autenticada.","Seules les routes renvoyées par le contrôle de sécurité authentifié sont listées.","Apenas as rotas retornadas pela verificação de segurança autenticada são listadas."],
  ["Status refreshes every 30 seconds. No credentials, environment values, or email content are displayed. App-level throttling is not a substitute for an edge DDoS/WAF service; large traffic floods require a provider such as Cloudflare in front of the domain.","El estado se actualiza cada 30 segundos. No se muestran credenciales, valores de entorno ni contenido de correo electrónico. La limitación a nivel de aplicación no sustituye a un servicio DDoS/WAF de borde; las grandes inundaciones de tráfico requieren un proveedor como Cloudflare frente al dominio.","L'état est rafraîchi toutes les 30 secondes. Aucune information d'identification, valeur d'environnement ou contenu d'e-mail n'est affiché. La limitation au niveau de l'application ne remplace pas un service DDoS/WAF périphérique ; les inondations de trafic importantes nécessitent un fournisseur tel que Cloudflare devant le domaine.","O status é atualizado a cada 30 segundos. Nenhuma credencial, valores de ambiente ou conteúdo de e-mail são exibidos. O limite de taxa no nível do aplicativo não substitui um serviço DDoS/WAF de borda; grandes volumes de tráfego exigem um provedor como o Cloudflare na frente do domínio."],
  ["Bitcoin mainnet","Bitcoin mainnet","Bitcoin mainnet","Bitcoin mainnet"],
  ["Solana mainnet","Solana mainnet","Solana mainnet","Solana mainnet"],
  ["Ethereum mainnet","Ethereum mainnet","Ethereum mainnet","Ethereum mainnet"],
  ["Litecoin mainnet","Litecoin mainnet","Litecoin mainnet","Litecoin mainnet"],
  ["Checkout is temporarily unavailable.","El proceso de pago no está disponible temporalmente.","Le paiement est temporairement indisponible.","O checkout está temporariamente indisponível."],
  ["Clipboard access is unavailable. Select and copy the address.","El acceso al portapapeles no está disponible. Seleccione y copie la dirección.","L'accès au presse-papiers est indisponible. Sélectionnez et copiez l'adresse.","O acesso à área de transferência está indisponível. Selecione e copie o endereço."],
  ["Use the matching mainnet. A transfer on another network will not be detected.","Utilice la mainnet correspondiente. Una transferencia en otra red no será detectada.","Utilisez le mainnet correspondant. Un transfert sur un autre réseau ne sera pas détecté.","Use a mainnet correspondente. Uma transferência em outra rede não será detectada."],
  ["Preparing payment request…","Preparando solicitud de pago...","Préparation de la demande de paiement...","Preparando solicitação de pagamento..."],
  ["New payment request","Nueva solicitud de pago","Nouvelle demande de paiement","Nova solicitação de pagamento"],
  ["Amount · about $","Cantidad · alrededor de $","Montant · environ $","Valor · cerca de $"],
  ["USD","USD","USD","USD"],
  ["Copy payment address","Copiar dirección de pago","Copier l'adresse de paiement","Copiar endereço de pagamento"],
  ["This request is checked automatically against the public blockchain for two hours. You do not need to press a confirmation button.","Esta solicitud se comprueba automáticamente con la cadena de bloques pública durante dos horas. No necesita presionar un botón de confirmación.","Cette demande est vérifiée automatiquement sur la blockchain publique pendant deux heures. Vous n'avez pas besoin d'appuyer sur un bouton de confirmation.","Esta solicitação é verificada automaticamente na blockchain pública por duas horas. Você não precisa pressionar um botão de confirmação."],
  ["Payment found; waiting for confirmations","Pago encontrado; esperando confirmaciones","Paiement trouvé ; en attente de confirmations","Pagamento encontrado; aguardando confirmações"],
  ["Automatically checking the public blockchain","Comprobando automáticamente la cadena de bloques pública","Vérification automatique de la blockchain publique","Verificando automaticamente a blockchain pública"],
  ["No action needed. We keep checking while this payment request is active.","No se necesita ninguna acción. Seguimos comprobando mientras esta solicitud de pago esté activa.","Aucune action requise. Nous continuons à vérifier tant que cette demande de paiement est active.","Nenhuma ação necessária. Continuamos verificando enquanto esta solicitação de pagamento estiver ativa."],
  ["Payment confirmed","Pago confirmado","Paiement confirmé","Pagamento confirmado"],
  ["Your older payment request is confirmed. Continue to create one account and save its access key.","Su solicitud de pago anterior ha sido confirmada. Continúe para crear una cuenta y guardar su clave de acceso.","Votre demande de paiement précédente est confirmée. Continuez pour créer un compte et enregistrer votre clé d'accès.","Sua solicitação de pagamento anterior foi confirmada. Continue para criar uma conta e salvar sua chave de acesso."],
  ["Continue to account creation","Continuar a la creación de cuenta","Continuer vers la création du compte","Continuar para a criação da conta"],
  ["Your permanent account link is being emailed. This page will update automatically.","Su enlace de cuenta permanente se está enviando por correo electrónico. Esta página se actualizará automáticamente.","Votre lien de compte permanent est en cours d'envoi par e-mail. Cette page se mettra à jour automatiquement.","Seu link de conta permanente está sendo enviado por e-mail. Esta página será atualizada automaticamente."],
  ["Send the exact quoted amount, with the network fee paid separately. A different amount may not match automatically.","Envíe la cantidad exacta indicada, con la tarifa de red pagada por separado. Una cantidad diferente puede no coincidir automáticamente.","Envoyez le montant exact indiqué, avec les frais de réseau payés séparément. Un montant différent peut ne pas correspondre automatiquement.","Envie o valor exato cotado, com a taxa de rede paga separadamente. Um valor diferente pode não corresponder automaticamente."],
  ["Blockchain transfers are public and generally irreversible. Public blockchain data services check the address and may retain their own logs. Your email is used only to deliver the account-creation link.","Las transferencias de cadena de bloques son públicas y, por lo general, irreversibles. Los servicios de datos de cadena de bloques pública comprueban la dirección y pueden conservar sus propios registros. Su correo electrónico se utiliza únicamente para enviar el enlace de creación de cuenta.","Les transferts blockchain sont publics et généralement irréversibles. Les services de données blockchain publics vérifient l'adresse et peuvent conserver leurs propres journaux. Votre e-mail n'est utilisé que pour transmettre le lien de création de compte.","As transferências em blockchain são públicas e geralmente irreversíveis. Os serviços de dados de blockchain públicos verificam o endereço e podem manter seus próprios logs. Seu e-mail é usado apenas para entregar o link de criação de conta."],
  ["We could not check this link. Open it again or try another connection.","No pudimos comprobar este enlace. Ábralo de nuevo o pruebe con otra conexión.","Nous n'avons pas pu vérifier ce lien. Ouvrez-le à nouveau ou essayez une autre connexion.","Não foi possível verificar este link. Abra-o novamente ou tente outra conexão."],
  ["Clipboard access is unavailable. Select and copy the key manually.","El acceso al portapapeles no está disponible. Seleccione y copie la clave manualmente.","L'accès au presse-papiers est indisponible. Sélectionnez et copiez la clé manuellement.","O acesso à área de transferência está indisponível. Selecione e copie a chave manualmente."],
  ["We could not create the account.","No pudimos crear la cuenta.","Nous n'avons pas pu créer le compte.","Não foi possível criar a conta."],
  ["Verifying your payment link…","Verificando su enlace de pago...","Vérification de votre lien de paiement...","Verificando seu link de pagamento..."],
  ["Account claim","Reclamación de cuenta","Réclamation de compte","Reivindicação de conta"],
  ["This link is unavailable.","Este enlace no está disponible.","Ce lien est indisponible.","Este link não está disponível."],
  ["It may have already been used or the link may be incomplete. An unused payment link does not expire.","Es posible que ya se haya utilizado o que el enlace esté incompleto. Un enlace de pago no utilizado no caduca.","Il peut avoir déjà été utilisé ou le lien peut être incomplet. Un lien de paiement inutilisé n'expire pas.","Pode já ter sido usado ou o link pode estar incompleto. Um link de pagamento não utilizado não expira."],
  ["Account options","Opciones de cuenta","Options de compte","Opções de conta"],
  ["You have verified your payment.","Ha verificado su pago.","Vous avez vérifié votre paiement.","Você verificou seu pagamento."],
  ["THANK YOU :)","GRACIAS :)","MERCI :)","OBRIGADO :)"],
  ["Your account link does not expire, but it can be used once to create one account.","Su enlace de cuenta no caduca, pero puede usarse una vez para crear una cuenta.","Votre lien de compte n'expire pas, mais il peut être utilisé une fois pour créer un compte.","Seu link de conta não expira, mas pode ser usado uma vez para criar uma conta."],
  ["Create your account.","Cree su cuenta.","Créez votre compte.","Crie sua conta."],
  ["Choose a username and save the 50-digit key below. The key is required every time you sign in.","Elija un nombre de usuario y guarde la clave de 50 dígitos a continuación. La clave es necesaria cada vez que inicie sesión.","Choisissez un nom d'utilisateur et enregistrez la clé de 50 chiffres ci-dessous. La clé est requise à chaque connexion.","Escolha um nome de usuário e salve a chave de 50 dígitos abaixo. A chave é necessária sempre que você fizer login."],
  ["Your email address will be","Su dirección de correo electrónico será","Votre adresse e-mail sera","Seu endereço de e-mail será"],
  ["Your sign-in key","Su clave de inicio de sesión","Votre clé de connexion","Sua chave de login"],
  ["Copy key","Copiar clave","Copier la clé","Copiar chave"],
  ["Save this key somewhere secure. It cannot be recovered if you lose it.","Guarde esta clave en un lugar seguro. No se puede recuperar si la pierde.","Enregistrez cette clé dans un endroit sûr. Elle ne peut pas être récupérée si vous la perdez.","Salve esta chave em um local seguro. Ela não pode ser recuperada se você a perder."],
  ["Creating account…","Creando cuenta...","Création du compte...","Criando conta..."],
  ["Add a valid recipient address.","Añada una dirección de destinatario válida.","Ajoutez une adresse de destinataire valide.","Adicione um endereço de destinatário válido."],
  ["A subject and a message are required.","Se requiere un asunto y un mensaje.","Un objet et un message sont requis.","Um assunto e uma mensagem são necessários."],
  ["The message could not be sent. Check the Brevo settings and try again.","No se pudo enviar el mensaje. Compruebe la configuración de Brevo e inténtelo de nuevo.","Le message n'a pas pu être envoyé. Vérifiez les paramètres de Brevo et réessayez.","A mensagem não pôde ser enviada. Verifique as configurações do Brevo e tente novamente."],
  ["Accepted by the delivery service","Aceptado por el servicio de entrega","Accepté par le service de livraison","Aceito pelo serviço de entrega"],
  ["Delivery timing and message handling can depend on external mail providers and recipient systems.","El tiempo de entrega y el manejo de los mensajes pueden depender de proveedores de correo externos y sistemas receptores.","Les délais de livraison et le traitement des messages dépendent des fournisseurs de messagerie externes et des systèmes des destinataires.","O tempo de entrega e o tratamento das mensagens podem depender de provedores de e-mail externos e sistemas receptores."],
  ["Write another","Escribir otro","En écrire un autre","Escrever outro"],
  ["New correspondence","Nueva correspondencia","Nouvelle correspondance","Nova correspondência"],
  ["Email travels through external providers and networks; their handling is outside this workspace.","El correo electrónico viaja a través de proveedores y redes externos; su manejo está fuera de este espacio de trabajo.","Les e-mails transitent par des fournisseurs et réseaux externes ; leur traitement est hors de cet espace de travail.","O e-mail trafega por provedores e redes externos; o tratamento deles está fora deste espaço de trabalho."],
  ["/ 100,000 characters","/ 100.000 caracteres","/ 100 000 caractères","/ 100.000 caracteres"],
  ["Unstar message","Quitar estrella al mensaje","Retirer l'étoile du message","Remover estrela da mensagem"],
  ["Star message","Destacar mensaje","Ajouter une étoile au message","Destacar mensagem"],
  ["Gathering your messages","Recopilando sus mensajes","Collecte de vos messages","Reunindo suas mensagens"],
  ["unread messages deserve your attention.","mensajes sin leer merecen su atención.","messages non lus méritent votre attention.","mensagens não lidas merecem sua atenção."],
  ["conversations","conversaciones","conversations","conversas"],
  ["Close message","Cerrar mensaje","Fermer le message","Fechar mensagem"],
  ["Opening message","Abriendo mensaje","Ouverture du message","Abrindo mensagem"],
  ["review carefully","revise cuidadosamente","examinez attentivement","revise cuidadosamente"],
  ["This message is stored in your MoralTown mailbox.","Este mensaje está almacenado en su buzón de MoralTown.","Ce message est stocké dans votre boîte aux lettres MoralTown.","Esta mensagem está armazenada em sua caixa de correio MoralTown."],
  ["Rotate your access key once to enable secure recovery for this legacy account.","Gire su clave de acceso una vez para habilitar la recuperación segura de esta cuenta antigua.","Faites pivoter votre clé d'accès une fois pour activer la récupération sécurisée de ce compte hérité.","Gire sua chave de acesso uma vez para habilitar a recuperação segura desta conta legada."],
  ["Your name","Su nombre","Votre nom","Seu nome"],
  ["Hide access key","Ocultar clave de acceso","Masquer la clé d'accès","Ocultar chave de acesso"],
  ["Reveal access key","Revelar clave de acceso","Révéler la clé d'accès","Revelar chave de acesso"],
  ["Copy access key","Copiar clave de acceso","Copier la clé d'accès","Copiar chave de acesso"],
  ["Label, e.g. essays","Etiqueta, p. ej., ensayos","Étiquette, ex. essais","Etiqueta, ex: ensaios"],
  ["Something went wrong","Algo salió mal","Une erreur est survenue","Algo deu errado"],
  ["This part of the app hit an error. The rest of the app is still running.","Esta parte de la aplicación encontró un error. El resto de la aplicación sigue funcionando.","Cette partie de l'application a rencontré une erreur. Le reste de l'application continue de fonctionner.","Esta parte do aplicativo encontrou um erro. O restante do aplicativo continua funcionando."],
  ["ErrorBoundary caught an error:","ErrorBoundary detectó un error:","ErrorBoundary a intercepté une erreur :","ErrorBoundary detectou um erro:"],
  ["Security status could not be reached.","No se pudo acceder al estado de seguridad.","Le statut de sécurité n'a pas pu être atteint.","O status de segurança não pôde ser alcançado."],
  ["Mobile mailbox","Buzón móvil","Boîte aux lettres mobile","Caixa de correio móvel"],
  ["Loading private workspace","Cargando espacio de trabajo privado","Chargement de l'espace de travail privé","Carregando espaço de trabalho privado"],
  ["Leave your private mailbox?","¿Salir de su buzón privado?","Quitter votre boîte aux lettres privée ?","Sair da sua caixa de correio privada?"],
  ["This link opens an external website. Check the address before continuing.","Este enlace abre un sitio web externo. Verifique la dirección antes de continuar.","Ce lien ouvre un site web externe. Vérifiez l'adresse avant de continuer.","Este link abre um site externo. Verifique o endereço antes de continuar."],
  ["Stay here","Permanecer aquí","Rester ici","Permanecer aqui"],
  ["Open link","Abrir enlace","Ouvrir le lien","Abrir link"],
  ["Account deletion could not be started.","No se pudo iniciar la eliminación de la cuenta.","La suppression du compte n'a pas pu être lancée.","A exclusão da conta não pôde ser iniciada."],
  ["Account removed","Cuenta eliminada","Compte supprimé","Conta removida"],
  ["Final account cleanup","Limpieza final de la cuenta","Nettoyage final du compte","Limpeza final da conta"],
  ["Deletion complete.","Eliminación completada.","Suppression terminée.","Exclusão concluída."],
  ["Your account is being removed.","Su cuenta está siendo eliminada.","Votre compte est en cours de suppression.","Sua conta está sendo removida."],
  ["The app has finished its account-data checks. Provider copies, platform logs, and public payment-network records are outside this cleanup.","La aplicación ha terminado sus comprobaciones de datos de la cuenta. Las copias del proveedor, los registros de la plataforma y los registros de la red de pagos pública quedan fuera de esta limpieza.","L'application a terminé ses vérifications des données du compte. Les copies des fournisseurs, les journaux de la plateforme et les enregistrements publics des réseaux de paiement sont exclus de ce nettoyage.","O aplicativo terminou suas verificações de dados da conta. Cópias de provedores, logs da plataforma e registros de redes de pagamento públicas estão fora desta limpeza."],
  ["Return to MoralTown","Volver a MoralTown","Retourner à MoralTown","Voltar para MoralTown"],
  ["Access has been revoked. Messages, folders, notifications, subscriptions, and account credentials were cleared when this request began. The server will repeat its account-linked database checks, then remove the temporary record.","El acceso ha sido revocado. Los mensajes, carpetas, notificaciones, suscripciones y credenciales de la cuenta se borraron cuando comenzó esta solicitud. El servidor repetirá sus comprobaciones de base de datos vinculadas a la cuenta y luego eliminará el registro temporal.","L'accès a été révoqué. Les messages, dossiers, notifications, abonnements et identifiants de compte ont été effacés au début de cette demande. Le serveur répétera ses vérifications de base de données liées au compte, puis supprimera l'enregistrement temporaire.","O acesso foi revogado. Mensagens, pastas, notificações, assinaturas e credenciais da conta foram apagadas quando esta solicitação começou. O servidor repetirá suas verificações de banco de dados vinculadas à conta e, em seguida, removerá o registro temporário."],
  ["database checks completed","comprobaciones de base de datos completadas","vérifications de base de données terminées","verificações de banco de dados concluídas"],
  ["The status check is offline. Deletion continues on the server; this screen will update when it reconnects.","La comprobación de estado está fuera de línea. La eliminación continúa en el servidor; esta pantalla se actualizará cuando se vuelva a conectar.","La vérification du statut est hors ligne. La suppression se poursuit sur le serveur ; cet écran sera mis à jour lors de la reconnexion.","A verificação de status está offline. A exclusão continua no servidor; esta tela será atualizada quando reconectar."],
  ["This countdown verifies records in MoralTown’s database. It does not delete copies held by email providers, hosting/platform logs, or public payment networks.","Esta cuenta regresiva verifica los registros en la base de datos de MoralTown. No elimina las copias mantenidas por los proveedores de correo electrónico, los registros de alojamiento/plataforma o las redes de pago públicas.","Ce compte à rebours vérifie les enregistrements dans la base de données de MoralTown. Il ne supprime pas les copies conservées par les fournisseurs de messagerie, les journaux d'hébergement/plateforme ou les réseaux de paiement publics.","Esta contagem regressiva verifica os registros no banco de dados da MoralTown. Ela não exclui cópias mantidas por provedores de e-mail, logs de hospedagem/plataforma ou redes de pagamento públicas."],
  ["Permanent action","Acción permanente","Action permanente","Ação permanente"],
  ["Kill switch","Interruptor de apagado","Interrupteur d'arrêt","Interruptor de desligamento"],
  ["Revoke access and permanently erase account data stored by this app.","Revocar acceso y borrar permanentemente los datos de la cuenta almacenados por esta aplicación.","Révoquer l'accès et effacer définitivement les données de compte stockées par cette application.","Revogar acesso e apagar permanentemente os dados da conta armazenados por este aplicativo."],
  ["Review permanent deletion","Revisar eliminación permanente","Examiner la suppression permanente","Revisar exclusão permanente"],
  ["What happens when you start:","Qué sucede cuando comienza:","Ce qui se passe lorsque vous commencez :","O que acontece quando você inicia:"],
  ["Access is revoked immediately; this account cannot be restored or signed into.","El acceso se revoca inmediatamente; esta cuenta no se puede restaurar ni iniciar sesión.","L'accès est révoqué immédiatement ; ce compte ne peut être ni restauré ni utilisé pour se connecter.","O acesso é revogado imediatamente; esta conta não pode ser restaurada ou acessada."],
  ["Messages, folders, notifications, subscriptions, account keys, and stored contact emails are erased or scrubbed from this service.","Los mensajes, carpetas, notificaciones, suscripciones, claves de cuenta y correos electrónicos de contacto almacenados se borran o eliminan de este servicio.","Les messages, dossiers, notifications, abonnements, clés de compte et e-mails de contact stockés sont effacés ou supprimés de ce service.","Mensagens, pastas, notificações, assinaturas, chaves de conta e e-mails de contato armazenados são apagados ou removidos deste serviço."],
  ["The server checks for remaining account-linked rows for four minutes, then removes its temporary deletion record.","El servidor busca filas vinculadas a la cuenta durante cuatro minutos y luego elimina su registro de eliminación temporal.","Le serveur vérifie les lignes liées au compte pendant quatre minutes, puis supprime son enregistrement de suppression temporaire.","O servidor verifica linhas vinculadas à conta por quatro minutos, depois remove seu registro de exclusão temporária."],
  ["This cannot erase messages already delivered to other mailboxes, copies kept by mail or hosting providers, platform/security logs, or public blockchain payment records. Non-identifying payment settlement details may be retained.","Esto no puede borrar mensajes ya entregados a otros buzones, copias guardadas por proveedores de correo o alojamiento, registros de plataforma/seguridad, o registros de pago de blockchain públicos. Los detalles de liquidación de pago no identificativos pueden ser retenidos.","Cela ne peut pas effacer les messages déjà livrés vers d'autres boîtes aux lettres, les copies conservées par les fournisseurs de messagerie ou d'hébergement, les journaux de plateforme/sécurité, ou les enregistrements de paiement blockchain publics. Les détails de règlement de paiement non identifiants peuvent être conservés.","Isso não pode apagar mensagens já entregues a outras caixas de correio, cópias mantidas por provedores de e-mail ou hospedagem, logs de plataforma/segurança ou registros de pagamento em blockchain públicos. Detalhes de liquidação de pagamento não identificáveis podem ser retidos."],
  ["There is no cancel or restore after deletion begins.","No hay cancelación ni restauración después de que comienza la eliminación.","Il n'y a pas d'annulation ou de restauration une fois la suppression lancée.","Não há cancelamento ou restauração após o início da exclusão."],
  ["Current 50-digit access key","Clave de acceso actual de 50 dígitos","Clé d'accès actuelle à 50 chiffres","Chave de acesso atual de 50 dígitos"],
  ["Enter your access key","Ingrese su clave de acceso","Entrez votre clé d'accès","Insira sua chave de acesso"],
  ["Required to confirm it is you. The key is sent only in the protected request body.","Requerido para confirmar que es usted. La clave se envía solo en el cuerpo de solicitud protegido.","Requis pour confirmer votre identité. La clé est envoyée uniquement dans le corps de la requête protégée.","Necessário para confirmar que é você. A chave é enviada apenas no corpo da solicitação protegida."],
  ["Type DELETE to confirm","Escriba DELETE para confirmar","Tapez DELETE pour confirmer","Digite DELETE para confirmar"],
  ["This starts the irreversible four-minute cleanup.","Esto inicia la limpieza irreversible de cuatro minutos.","Ceci lance le nettoyage irréversible de quatre minutes.","Isso inicia a limpeza irreversível de quatro minutos."],
  ["Go back","Volver","Retour","Voltar"],
  ["Starting deletion…","Iniciando eliminación…","Lancement de la suppression...","Iniciando exclusão..."],
  ["Delete account permanently","Eliminar cuenta permanentemente","Supprimer définitivement le compte","Excluir conta permanentemente"],
  ["Mobile app","Aplicación móvil","Application mobile","Aplicativo móvel"],
  ["Keep MoralTown on your home screen","Mantener MoralTown en su pantalla de inicio","Gardez MoralTown sur votre écran d'accueil","Mantenha o MoralTown na sua tela inicial"],
  ["Install opens the mailbox in a standalone app window. Mailbox links stay inside that window.","La instalación abre el buzón en una ventana de aplicación independiente. Los enlaces del buzón permanecen dentro de esa ventana.","L'installation ouvre la boîte aux lettres dans une fenêtre d'application autonome. Les liens de la boîte aux lettres restent dans cette fenêtre.","A instalação abre a caixa de correio em uma janela de aplicativo independente. Os links da caixa de correio permanecem dentro dessa janela."],
  ["MoralTown is open as an installed app.","MoralTown está abierto como una aplicación instalada.","MoralTown est ouvert en tant qu'application installée.","MoralTown está aberto como um aplicativo instalado."],
  ["Install MoralTown","Instalar MoralTown","Installer MoralTown","Instalar MoralTown"],
  ["In Safari, tap Share, then Add to Home Screen. Open the new home-screen icon to use the standalone app.","En Safari, toque Compartir, luego Agregar a pantalla de inicio. Abra el nuevo icono de la pantalla de inicio para usar la aplicación independiente.","Dans Safari, appuyez sur Partager, puis sur Ajouter à l'écran d'accueil. Ouvrez la nouvelle icône de l'écran d'accueil pour utiliser l'application autonome.","No Safari, toque em Compartilhar e depois em Adicionar à tela de início. Abra o novo ícone da tela inicial para usar o aplicativo independente."],
  ["Open your browser menu and choose Install app or Add to Home Screen. Then launch MoralTown from its new icon.","Abra el menú de su navegador y elija Instalar aplicación o Agregar a pantalla de inicio. Luego, inicie MoralTown desde su nuevo icono.","Ouvrez le menu de votre navigateur et choisissez Installer l'application ou Ajouter à l'écran d'accueil. Ensuite, lancez MoralTown à partir de sa nouvelle icône.","Abra o menu do seu navegador e escolha Instalar aplicativo ou Adicionar à tela de início. Em seguida, inicie o MoralTown a partir do seu novo ícone."],
  ["No analytics available yet.","Aún no hay analíticas disponibles.","Aucune donnée analytique disponible pour l'instant.","Ainda não há análises disponíveis."],
  ["No API traffic counted yet.","Aún no se ha registrado tráfico de API.","Aucun trafic API enregistré pour l'instant.","Nenhum tráfego de API registrado ainda."],
  ["Visible notice only. Never put credentials or private information here.","Solo aviso visible. Nunca coloque credenciales o información privada aquí.","Avis visible uniquement. Ne jamais saisir d'identifiants ou d'informations privées ici.","Aviso visível apenas. Nunca insira credenciais ou informações privadas aqui."],
  ["Announcement message","Mensaje de anuncio","Message d'annonce","Mensagem de anúncio"],
  ["No user records returned.","No se encontraron registros de usuario.","Aucun enregistrement utilisateur trouvé.","Nenhum registro de usuário encontrado."],
  ["A live view of mailbox readiness, service dependencies, and registered API routes. No configuration values or message contents are exposed.","Vista en vivo del estado del buzón, dependencias de servicio y rutas de API registradas. No se exponen valores de configuración ni contenidos de mensajes.","Vue en direct de l'état de la boîte mail, des dépendances de service et des routes API enregistrées. Aucune valeur de configuration ni contenu de message n'est exposé.","Visualização em tempo real da prontidão da caixa de entrada, dependências de serviço e rotas de API registradas. Nenhum valor de configuração ou conteúdo de mensagem é exposto."],
  ["One or more required dependencies are unavailable. DO NOT USE THE MAILBOX until all required integrations and protections are active.","Una o más dependencias requeridas no están disponibles. NO UTILICE EL BUZÓN hasta que todas las integraciones y protecciones requeridas estén activas.","Une ou plusieurs dépendances requises sont indisponibles. N'UTILISEZ PAS LA BOÎTE MAIL tant que toutes les intégrations et protections requises ne sont pas actives.","Uma ou mais dependências necessárias não estão disponíveis. NÃO USE A CAIXA DE ENTRADA até que todas as integrações e proteções necessárias estejam ativas."],
  ["The final crypto amount is calculated from the live exchange rate when you create a payment request. Exact amount and address appear in the next step.","El importe final en cripto se calcula según el tipo de cambio en tiempo real al crear la solicitud de pago. El importe exacto y la dirección aparecerán en el siguiente paso.","Le montant crypto final est calculé selon le taux de change en direct lors de la création de la demande de paiement. Le montant exact et l'adresse apparaîtront à l'étape suivante.","O valor final em cripto é calculado com base na taxa de câmbio em tempo real ao criar a solicitação de pagamento. O valor exato e o endereço aparecerão na próxima etapa."],
  ["Have a free access code?","¿Tiene un código de acceso gratuito?","Vous avez un code d'accès gratuit ?","Você tem um código de acesso gratuito?"],
  ["Create an account instead","Crear una cuenta en su lugar","Créer un compte à la place","Criar uma conta em vez disso"],
  ["Back","Atrás","Retour","Voltar"],
  ["Email for your account link","Correo electrónico para el enlace de su cuenta","E-mail pour le lien de votre compte","E-mail para o link da sua conta"],
  ["We only use this address to send the one-time link after your payment is verified.","Solo usamos esta dirección para enviar el enlace de un solo uso después de verificar su pago.","Nous n'utilisons cette adresse que pour envoyer le lien unique après vérification de votre paiement.","Usamos este endereço apenas para enviar o link de uso único após a verificação do seu pagamento."],
  ["Send exact amount /","Enviar importe exacto /","Envoyer le montant exact /","Enviar valor exato /"],
  ["Send to ·","Enviar a ·","Envoyer à ·","Enviar para ·"],
  ["The two-hour payment window has ended. We are finishing this check before closing the request.","La ventana de pago de dos horas ha finalizado. Estamos terminando esta verificación antes de cerrar la solicitud.","La fenêtre de paiement de deux heures est terminée. Nous terminons cette vérification avant de fermer la demande.","O prazo de pagamento de duas horas terminou. Estamos concluindo esta verificação antes de fechar a solicitação."],
  ["Your one-time account link has been emailed. It does not expire and can be used to create one account. Check your spam folder if it is not in your inbox.","Se ha enviado por correo electrónico su enlace de cuenta de un solo uso. No caduca y se puede usar para crear una cuenta. Revise su carpeta de correo no deseado si no está en su bandeja de entrada.","Votre lien de compte unique a été envoyé par e-mail. Il n'expire pas et peut être utilisé pour créer un compte. Vérifiez votre dossier spam s'il n'est pas dans votre boîte de réception.","Seu link de conta de uso único foi enviado por e-mail. Ele não expira e pode ser usado para criar uma conta. Verifique sua pasta de spam se não estiver na sua caixa de entrada."],
  ["This payment request expired without a matching blockchain transfer. If you already paid, do not pay again until the transfer has been checked.","Esta solicitud de pago expiró sin una transferencia de blockchain coincidente. Si ya pagó, no vuelva a pagar hasta que se haya verificado la transferencia.","Cette demande de paiement a expiré sans transfert blockchain correspondant. Si vous avez déjà payé, ne payez pas à nouveau avant que le transfert n'ait été vérifié.","Esta solicitação de pagamento expirou sem uma transferência blockchain correspondente. Se você já pagou, não pague novamente até que a transferência tenha sido verificada."],
  ["Next","Siguiente","Suivant","Próximo"],
  ["It is on its way.","Está en camino.","C'est en route.","Está a caminho."],
];

const dictionaries: Record<Exclude<LanguageCode, 'en'>, Map<string, string>> = {
  es: new Map(rows.map(([source, spanish]) => [source, spanish])),
  fr: new Map(rows.map(([source, , french]) => [source, french])),
  pt: new Map(rows.map(([source, , , portuguese]) => [source, portuguese])),
};

const textOrigins = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, { language: LanguageCode; value: string }>();
const attributeOrigins = new WeakMap<Element, Map<string, string>>();
const renderedAttributes = new WeakMap<Element, Map<string, { language: LanguageCode; value: string }>>();
const translatedAttributes = ['placeholder', 'aria-label', 'aria-description', 'title', 'alt'];
let observer: MutationObserver | null = null;

export function readLanguage(): LanguageCode {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return languages.some((language) => language.code === value) ? (value as LanguageCode) : 'en';
  } catch {
    return 'en';
  }
}

export function getCurrentLocale(): string {
  return languages.find((language) => language.code === readLanguage())?.locale ?? 'en';
}

function reverseDictionary(language: LanguageCode): Map<string, string> {
  const reverse = new Map<string, string>();
  if (language !== 'en') {
    for (const [source, translated] of dictionaries[language]) reverse.set(translated, source);
  }
  return reverse;
}

function translateText(node: Text, language: LanguageCode, reverse: Map<string, string>): void {
  const current = node.nodeValue ?? '';
  const previousRender = renderedText.get(node);
  if (previousRender?.language === language && previousRender.value === current) return;
  let source = textOrigins.get(node);
  if (source === undefined || (previousRender && previousRender.value !== current)) {
    source = reverse.get(current.trim()) ?? current.trim();
    textOrigins.set(node, source);
  }
  const leading = current.match(/^\s*/)?.[0] ?? '';
  const trailing = current.match(/\s*$/)?.[0] ?? '';
  const content = source.trim();
  const translated = language === 'en' ? content : (dictionaries[language]?.get(content) ?? content);
  const value = `${leading}${translated}${trailing}`;
  renderedText.set(node, { language, value });
  if (value !== current) node.nodeValue = value;
}

function translateAttribute(element: Element, name: string, language: LanguageCode, reverse: Map<string, string>): void {
  const current = element.getAttribute(name);
  if (current === null) return;
  let originals = attributeOrigins.get(element);
  if (!originals) {
    originals = new Map();
    attributeOrigins.set(element, originals);
  }
  let renders = renderedAttributes.get(element);
  if (!renders) {
    renders = new Map();
    renderedAttributes.set(element, renders);
  }
  const previousRender = renders.get(name);
  if (previousRender?.language === language && previousRender.value === current) return;
  let source = originals.get(name);
  if (source === undefined || (previousRender && previousRender.value !== current)) {
    source = reverse.get(current) ?? current;
    originals.set(name, source);
  }
  const value = language === 'en' ? source : (dictionaries[language]?.get(source) ?? source);
  renders.set(name, { language, value });
  if (value !== current) element.setAttribute(name, value);
}

function translateElement(element: Element, language: LanguageCode, reverse: Map<string, string>): void {
  if (element.matches('script,style,noscript,code,pre,[contenteditable="true"],[data-no-translate]')) return;
  for (const name of translatedAttributes) translateAttribute(element, name, language, reverse);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest('script,style,noscript,code,pre,[contenteditable="true"],[data-no-translate]')) {
      translateText(textNode, language, reverse);
    }
    node = walker.nextNode();
  }
}

export function setLanguage(language: LanguageCode): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Keep the current page usable if browser storage is unavailable.
  }
  if (typeof document !== 'undefined') {
    const locale = languages.find((item) => item.code === language)?.locale ?? 'en';
    document.documentElement.lang = locale;
    document.documentElement.dataset.language = language;
    if (document.body) translateElement(document.body, language, reverseDictionary(language));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED_EVENT, { detail: language }));
  }
}

export function startLanguageRuntime(): void {
  if (typeof document === 'undefined' || !document.body) return;
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      const language = readLanguage();
      const reverse = reverseDictionary(language);
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) {
          const parent = mutation.target.parentElement;
          if (parent) translateElement(parent, language, reverse);
        } else if (mutation.type === 'attributes' && mutation.target instanceof Element && mutation.attributeName) {
          translateAttribute(mutation.target, mutation.attributeName, language, reverse);
        } else {
          for (const added of Array.from(mutation.addedNodes)) {
            if (added instanceof Element) translateElement(added, language, reverse);
            else if (added instanceof Text && added.parentElement) translateElement(added.parentElement, language, reverse);
          }
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes,
    });
  }
  setLanguage(readLanguage());
}

export function useLanguage(): [LanguageCode, (next: LanguageCode) => void] {
  const [language, setCurrent] = useState<LanguageCode>(() => readLanguage());
  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<LanguageCode>).detail;
      if (next) setCurrent(next);
    };
    window.addEventListener(LANGUAGE_CHANGED_EVENT, update);
    return () => window.removeEventListener(LANGUAGE_CHANGED_EVENT, update);
  }, []);
  return [language, setLanguage];
}
