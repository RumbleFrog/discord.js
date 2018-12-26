'use strict';

const Channel = require('./Channel');
const TextBasedChannel = require('./interfaces/TextBasedChannel');
const Collection = require('../util/Collection');
const DataResolver = require('../util/DataResolver');
const MessageStore = require('../stores/MessageStore');

/*
{ type: 3,
  recipients:
   [ { username: 'Charlie',
       id: '123',
       discriminator: '6631',
       avatar: '123' },
     { username: 'Ben',
       id: '123',
       discriminator: '2055',
       avatar: '123' },
     { username: 'Adam',
       id: '123',
       discriminator: '2406',
       avatar: '123' } ],
  owner_id: '123',
  name: null,
  last_message_id: '123',
  id: '123',
  icon: null }
*/

/**
 * Represents a Group DM on Discord.
 * @extends {Channel}
 * @implements {TextBasedChannel}
 */
class GroupDMChannel extends Channel {
  constructor(client, data) {
    super(client, data);
    /**
     * A collection containing the messages sent to this channel
     * @type {MessageStore<Snowflake, Message>}
     */
    this.messages = new MessageStore(this);
    this._typing = new Map();
  }

  _patch(data) {
    super._patch(data);

    /**
     * The name of this Group DM, can be null if one isn't set
     * @type {string}
     */
    this.name = data.name;

    /**
     * A hash of this Group DM icon
     * @type {?string}
     */
    this.icon = data.icon;

    /**
     * The user ID of this Group DM's owner
     * @type {Snowflake}
     */
    this.ownerID = data.owner_id;

    /**
     * If the DM is managed by an application
     * @type {boolean}
     */
    this.managed = data.managed;

    /**
     * Application ID of the application that made this Group DM, if applicable
     * @type {?Snowflake}
     */
    this.applicationID = data.application_id;

    if (data.nicks) {
      /**
       * Nicknames for group members
       * @type {?Collection<Snowflake, string>}
       */
      this.nicks = new Collection(data.nicks.map(n => [n.id, n.nick]));
    }

    if (!this.recipients) {
      /**
       * A collection of the recipients of this DM, mapped by their ID
       * @type {Collection<Snowflake, User>}
       */
      this.recipients = new Collection();
    }

    if (data.recipients) {
      for (const recipient of data.recipients) {
        const user = this.client.users.add(recipient);
        this.recipients.set(user.id, user);
      }
    }

    /**
     * The ID of the last message in the channel, if one was sent
     * @type {?Snowflake}
     */
    this.lastMessageID = data.last_message_id;

    /**
     * The timestamp when the last pinned message was pinned, if there was one
     * @type {?number}
     */
    this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
  }

  /**
   * The owner of this Group DM
   * @type {?User}
   * @readonly
   */
  get owner() {
    return this.client.users.get(this.ownerID) || null;
  }

  /**
   * Gets the URL to this Group DM's icon.
   * @param {ImageURLOptions} [options={}] Options for the Image URL
   * @returns {?string}
   */
  iconURL({ format, size } = {}) {
    if (!this.icon) return null;
    return this.client.rest.cdn.GDMIcon(this.id, this.icon, format, size);
  }

  /**
   * Whether this channel equals another channel. It compares all properties, so for most operations
   * it is advisable to just compare `channel.id === channel2.id` as it is much faster and is often
   * what most users need.
   * @param {GroupDMChannel} channel Channel to compare with
   * @returns {boolean}
   */
  equals(channel) {
    const equal = channel &&
      this.id === channel.id &&
      this.name === channel.name &&
      this.icon === channel.icon &&
      this.ownerID === channel.ownerID;

    if (equal) {
      return this.recipients.equals(channel.recipients);
    }

    return equal;
  }

  /**
   * Edits this Group DM.
   * @param {Object} data New data for this Group DM
   * @param {string} [reason] Reason for editing this Group DM
   * @returns {Promise<GroupDMChannel>}
   */
  edit(data, reason) {
    return this.client.api.channels[this.id].patch({
      data: {
        icon: data.icon,
        name: data.name === null ? null : data.name || this.name,
      },
      reason,
    }).then(() => this);
  }

  /**
   * Sets a new icon for this Group DM.
   * @param {Base64Resolvable|BufferResolvable} icon The new icon of this Group DM
   * @returns {Promise<GroupDMChannel>}
   */
  async setIcon(icon) {
    return this.edit({ icon: await DataResolver.resolveImage(icon) });
  }

  /**
   * Sets a new name for this Group DM.
   * @param {string} name New name for this Group DM
   * @returns {Promise<GroupDMChannel>}
   */
  setName(name) {
    return this.edit({ name });
  }

  /**
   * Adds a user to this Group DM.
   * @param {Object} options Options for this method
   * @param {UserResolvable} options.user User to add to this Group DM
   * @param {string} [options.accessToken] Access token to use to add the user to this Group DM
   * @param {string} [options.nick] Permanent nickname to give the user
   * @returns {Promise<GroupDMChannel>}
   */
  addUser({ user, accessToken, nick }) {
    const id = this.client.users.resolveID(user);
    return this.client.api.channels[this.id].recipients[id].put({ nick, access_token: accessToken })
      .then(() => this);
  }

  /**
   * Removes a user from this Group DM.
   * @param {UserResolvable} user User to remove
   * @returns {Promise<GroupDMChannel>}
   */
  removeUser(user) {
    const id = this.client.users.resolveID(user);
    return this.client.api.channels[this.id].recipients[id].delete()
      .then(() => this);
  }

  /**
   * When concatenated with a string, this automatically returns the channel's name instead of the
   * GroupDMChannel object.
   * @returns {string}
   * @example
   * // Logs: Hello from My Group DM!
   * console.log(`Hello from ${channel}!`);
   */
  toString() {
    return this.name;
  }

  // These are here only for documentation purposes - they are implemented by TextBasedChannel
  /* eslint-disable no-empty-function */
  get lastMessage() {}
  get lastPinAt() {}
  send() {}
  search() {}
  startTyping() {}
  stopTyping() {}
  get typing() {}
  get typingCount() {}
  createMessageCollector() {}
  awaitMessages() {}
  // Doesn't work on Group DMs; bulkDelete() {}
  acknowledge() {}
  _cacheMessage() {}
}

TextBasedChannel.applyToClass(GroupDMChannel, true, ['bulkDelete']);

module.exports = GroupDMChannel;
